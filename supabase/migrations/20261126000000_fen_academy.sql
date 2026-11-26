-- =============================================================================
--  Fen Academy · esquema para Supabase (PostgreSQL)
--
--  Migración inicial. Se aplica sola si conectaste el repositorio con la
--  integración de GitHub de Supabase; si no, pegá TODO este archivo en
--  "SQL Editor" y presioná "Run" (una sola vez, en un proyecto nuevo).
--
--  La seguridad NO depende de la página: cada tabla tiene Row Level Security
--  (RLS). Aunque alguien modifique el JavaScript, la base rechaza lo que su
--  rol no puede hacer. Las acciones delicadas (matricularse, entregar, rendir
--  y corregir exámenes, cambiar roles) pasan por funciones que validan todo.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

create schema fen;   -- funciones auxiliares privadas

-- -----------------------------------------------------------------------------
--  Tablas
-- -----------------------------------------------------------------------------

-- Perfil de cada usuario. El rol lo cambia solo un admin.
create table public.perfiles (
    id               uuid primary key references auth.users (id) on delete cascade,
    nombre           text not null,
    usuario          text not null unique,
    email            text,
    rol             text not null default 'estudiante' check (rol in ('estudiante', 'profesor', 'admin')),
    fecha_nacimiento date,
    fecha_registro   timestamptz not null default now()
);

-- Materias. Los cursos de un mismo lenguaje forman una ruta por niveles.
create table public.cursos (
    id          bigint generated always as identity primary key,
    codigo      text not null unique,          -- ej. PY-1; evita confundir Java con JavaScript
    nombre      text not null,
    lenguaje    text not null,
    nivel       int  not null check (nivel >= 1),
    descripcion text,
    profesor_id uuid references public.perfiles (id) on delete set null
);

create table public.matriculas (
    id       bigint generated always as identity primary key,
    user_id  uuid   not null references public.perfiles (id) on delete cascade,
    curso_id bigint not null references public.cursos (id) on delete cascade,
    estado   text   not null default 'Cursando' check (estado in ('Cursando', 'Aprobado', 'Reprobado')),
    fecha    timestamptz not null default now(),
    unique (user_id, curso_id)
);

create table public.clases (
    id          bigint generated always as identity primary key,
    curso_id    bigint not null references public.cursos (id) on delete cascade,
    titulo      text not null,
    descripcion text,
    orden       int not null default 1
);

-- Actividad evaluada: entrega de trabajo o examen. "valor" = % de la nota final.
create table public.actividades (
    id               bigint generated always as identity primary key,
    curso_id         bigint not null references public.cursos (id) on delete cascade,
    clase_id         bigint references public.clases (id) on delete set null,
    tipo             text not null default 'entrega' check (tipo in ('entrega', 'examen')),
    titulo           text not null,
    descripcion      text,
    fecha_limite     date,
    valor            numeric(5,2) not null default 0 check (valor between 0 and 100),
    publicada        boolean not null default true,
    duracion_minutos int check (duracion_minutos is null or duracion_minutos > 0),
    mostrar_solucion boolean not null default false
);

-- Preguntas y opciones de un examen (sin la respuesta correcta).
create table public.preguntas (
    id           bigint generated always as identity primary key,
    actividad_id bigint not null references public.actividades (id) on delete cascade,
    orden        int not null default 1,
    enunciado    text not null,
    tipo         text not null check (tipo in ('opcion_unica', 'respuesta_corta')),
    puntos       numeric(6,2) not null default 1 check (puntos > 0)
);

create table public.opciones (
    id          bigint generated always as identity primary key,
    pregunta_id bigint not null references public.preguntas (id) on delete cascade,
    texto       text not null
);

-- Respuestas correctas: tabla aparte que los estudiantes NO pueden leer.
create table public.claves (
    pregunta_id          bigint primary key references public.preguntas (id) on delete cascade,
    opcion_correcta_id   bigint references public.opciones (id) on delete cascade,
    respuestas_aceptadas text   -- respuesta corta: "8|ocho"
);

-- Trabajo entregado. En un examen, la entrega es el intento enviado (sin archivo).
create table public.entregas (
    id                bigint generated always as identity primary key,
    actividad_id      bigint not null references public.actividades (id) on delete cascade,
    user_id           uuid   not null references public.perfiles (id) on delete cascade,
    archivo_path      text,               -- ruta en el bucket "archivos"
    nombre_original   text,
    enlace            text,               -- ej. repositorio de GitHub
    comentario        text,
    estado            text not null default 'Pendiente' check (estado in ('Pendiente', 'Revisado', 'Aprobado', 'Rechazado')),
    nota              numeric(5,2) check (nota is null or nota between 0 and 100),
    retroalimentacion text,
    fecha_entrega     timestamptz not null default now(),
    fuera_de_tiempo   boolean not null default false
);

-- Inicio de un examen: un único intento por estudiante.
create table public.intentos (
    id           bigint generated always as identity primary key,
    actividad_id bigint not null references public.actividades (id) on delete cascade,
    user_id      uuid   not null references public.perfiles (id) on delete cascade,
    inicio       timestamptz not null default now(),
    entrega_id   bigint references public.entregas (id) on delete set null,
    unique (actividad_id, user_id)
);

create table public.respuestas (
    id               bigint generated always as identity primary key,
    entrega_id       bigint not null references public.entregas (id) on delete cascade,
    pregunta_id      bigint not null references public.preguntas (id) on delete cascade,
    opcion_id        bigint references public.opciones (id) on delete set null,
    texto            text,
    correcta         boolean not null default false,
    corregida_manual boolean not null default false
);

create table public.recursos (
    id              bigint generated always as identity primary key,
    curso_id        bigint not null references public.cursos (id) on delete cascade,
    user_id         uuid   not null references public.perfiles (id) on delete cascade,
    titulo          text not null,
    archivo_path    text,
    nombre_original text,
    enlace          text,
    fecha_subida    timestamptz not null default now()
);

create index on public.matriculas (curso_id);
create index on public.actividades (curso_id);
create index on public.entregas (actividad_id, user_id);
create index on public.preguntas (actividad_id);
create index on public.opciones (pregunta_id);

-- -----------------------------------------------------------------------------
--  Funciones auxiliares de permisos (privadas, esquema "fen")
-- -----------------------------------------------------------------------------

create function fen.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
    select rol from public.perfiles where id = auth.uid()
$$;

create function fen.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce(fen.mi_rol() = 'admin', false)
$$;

-- Profesor asignado al curso, o admin.
create function fen.es_docente(p_curso bigint) returns boolean
language sql stable security definer set search_path = '' as $$
    select fen.es_admin() or exists (
        select 1 from public.cursos c
        join public.perfiles p on p.id = c.profesor_id
        where c.id = p_curso and c.profesor_id = auth.uid() and p.rol = 'profesor')
$$;

create function fen.esta_matriculado(p_curso bigint) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.matriculas where curso_id = p_curso and user_id = auth.uid())
$$;

create function fen.curso_de_actividad(p_actividad bigint) returns bigint
language sql stable security definer set search_path = '' as $$
    select curso_id from public.actividades where id = p_actividad
$$;

create function fen.curso_de_pregunta(p_pregunta bigint) returns bigint
language sql stable security definer set search_path = '' as $$
    select a.curso_id from public.preguntas p join public.actividades a on a.id = p.actividad_id where p.id = p_pregunta
$$;

-- "  Élif. " -> "elif": minúsculas, sin tildes, espacios simples, sin puntuación final.
create function fen.normalizar(t text) returns text
language sql immutable set search_path = '' as $$
    select rtrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent', trim(coalesce(t, '')))), '\s+', ' ', 'g'), '.;!')
$$;

create function fen.es_numero(t text) returns numeric
language plpgsql immutable set search_path = '' as $$
begin
    return replace(t, ',', '.')::numeric;
exception when others then
    return null;
end $$;

-- Compara contra cada respuesta aceptada ("8|ocho"). Los números se comparan por valor (3 = 3.0).
create function fen.respuesta_corta_correcta(p_aceptadas text, p_respuesta text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
    r text := fen.normalizar(p_respuesta);
    a text;
begin
    if r = '' then return false; end if;
    foreach a in array string_to_array(coalesce(p_aceptadas, ''), '|') loop
        a := fen.normalizar(a);
        if a = '' then continue; end if;
        if r = a then return true; end if;
        if fen.es_numero(r) is not null and fen.es_numero(a) is not null and fen.es_numero(r) = fen.es_numero(a) then
            return true;
        end if;
    end loop;
    return false;
end $$;

create function fen.recalcular_nota(p_entrega bigint) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
    v_total numeric;
    v_ok numeric;
    v_nota numeric;
begin
    select coalesce(sum(p.puntos), 0) into v_total
    from public.preguntas p join public.entregas e on e.actividad_id = p.actividad_id
    where e.id = p_entrega;

    select coalesce(sum(p.puntos), 0) into v_ok
    from public.respuestas r join public.preguntas p on p.id = r.pregunta_id
    where r.entrega_id = p_entrega and r.correcta;

    v_nota := case when v_total > 0 then round(v_ok * 100 / v_total, 2) else 0 end;
    update public.entregas set nota = v_nota where id = p_entrega;
    return v_nota;
end $$;

-- -----------------------------------------------------------------------------
--  Triggers: reglas que valen siempre
-- -----------------------------------------------------------------------------

-- Al registrarse, se crea su perfil como ESTUDIANTE (nunca puede elegir otro rol).
create function fen.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    v_usuario text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'usuario'), ''), split_part(new.email, '@', 1));
begin
    -- Si el nombre de usuario ya existe, le agregamos un sufijo.
    if exists (select 1 from public.perfiles where usuario = v_usuario) then
        v_usuario := v_usuario || '-' || substr(new.id::text, 1, 4);
    end if;
    insert into public.perfiles (id, nombre, usuario, email, rol)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), v_usuario), v_usuario, new.email, 'estudiante');
    return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
    for each row execute function fen.crear_perfil();

-- Código en mayúsculas sin espacios y lenguaje con la escritura ya existente ("python" -> "Python").
create function fen.normalizar_curso() returns trigger
language plpgsql set search_path = '' as $$
declare
    v_existente text;
begin
    new.codigo := upper(regexp_replace(trim(new.codigo), '\s+', '-', 'g'));
    new.lenguaje := regexp_replace(trim(new.lenguaje), '\s+', ' ', 'g');
    select lenguaje into v_existente from public.cursos
    where lower(lenguaje) = lower(new.lenguaje) and id is distinct from new.id limit 1;
    new.lenguaje := coalesce(v_existente, new.lenguaje);
    if new.profesor_id is not null and not exists (
        select 1 from public.perfiles where id = new.profesor_id and rol = 'profesor') then
        raise exception 'El profesor asignado debe tener rol de profesor.';
    end if;
    return new;
end $$;

create trigger normalizar_curso before insert or update on public.cursos
    for each row execute function fen.normalizar_curso();

-- El desglose de un curso (entregas + exámenes) no puede pasar de 100 %.
create function fen.validar_valor() returns trigger
language plpgsql set search_path = '' as $$
declare
    v_usado numeric;
begin
    select coalesce(sum(valor), 0) into v_usado from public.actividades
    where curso_id = new.curso_id and id is distinct from new.id;
    if v_usado + new.valor > 100 then
        raise exception 'El desglose superaría el 100%%. Ya hay % %% asignado; quedan % %%.', v_usado, 100 - v_usado;
    end if;
    if new.clase_id is not null and not exists (
        select 1 from public.clases where id = new.clase_id and curso_id = new.curso_id) then
        new.clase_id := null;
    end if;
    return new;
end $$;

create trigger validar_valor before insert or update on public.actividades
    for each row execute function fen.validar_valor();

-- Cuando un estudiante ya empezó el examen, las preguntas no se pueden tocar.
create function fen.bloquear_si_hay_intentos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    v_actividad bigint;
begin
    if tg_table_name = 'preguntas' then
        v_actividad := coalesce(new.actividad_id, old.actividad_id);
    elsif tg_table_name = 'opciones' then
        select actividad_id into v_actividad from public.preguntas where id = coalesce(new.pregunta_id, old.pregunta_id);
    else
        select actividad_id into v_actividad from public.preguntas where id = coalesce(new.pregunta_id, old.pregunta_id);
    end if;
    -- Si se está borrando el examen entero (o el curso), se permite.
    if tg_op = 'DELETE' and not exists (select 1 from public.actividades where id = v_actividad) then
        return old;
    end if;
    if exists (select 1 from public.intentos where actividad_id = v_actividad) then
        raise exception 'Ya hay estudiantes que empezaron el examen: no se pueden cambiar las preguntas.';
    end if;
    return coalesce(new, old);
end $$;

create trigger bloquear_preguntas before insert or update or delete on public.preguntas
    for each row execute function fen.bloquear_si_hay_intentos();
create trigger bloquear_opciones before insert or update or delete on public.opciones
    for each row execute function fen.bloquear_si_hay_intentos();
create trigger bloquear_claves before insert or update or delete on public.claves
    for each row execute function fen.bloquear_si_hay_intentos();

-- Un examen sin preguntas no se puede publicar.
create function fen.validar_publicacion() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.tipo = 'examen' and new.publicada and not exists (
        select 1 from public.preguntas where actividad_id = new.id) then
        raise exception 'Agregá al menos una pregunta antes de publicar el examen.';
    end if;
    return new;
end $$;

create trigger validar_publicacion before insert or update on public.actividades
    for each row execute function fen.validar_publicacion();

-- -----------------------------------------------------------------------------
--  Row Level Security: quién puede ver y modificar cada tabla
-- -----------------------------------------------------------------------------

alter table public.perfiles    enable row level security;
alter table public.cursos      enable row level security;
alter table public.matriculas  enable row level security;
alter table public.clases      enable row level security;
alter table public.actividades enable row level security;
alter table public.preguntas   enable row level security;
alter table public.opciones    enable row level security;
alter table public.claves      enable row level security;
alter table public.entregas    enable row level security;
alter table public.intentos    enable row level security;
alter table public.respuestas  enable row level security;
alter table public.recursos    enable row level security;

-- Los visitantes sin sesión no ven nada.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant usage on schema fen to authenticated;

-- perfiles: todos los usuarios con sesión ven nombres (para listas de curso).
-- Cada uno edita SOLO nombre, usuario y fecha de nacimiento (no el rol).
-- El correo y la fecha de nacimiento son privados: se leen con mi_perfil() o admin_usuarios().
revoke select on public.perfiles from authenticated;
grant select (id, nombre, usuario, rol, fecha_registro) on public.perfiles to authenticated;
create policy perfiles_ver on public.perfiles for select to authenticated using (true);
grant update (nombre, usuario, fecha_nacimiento) on public.perfiles to authenticated;
create policy perfiles_editar on public.perfiles for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());

-- cursos: el catálogo es visible para todos; solo el admin lo modifica.
create policy cursos_ver on public.cursos for select to authenticated using (true);
grant insert, update, delete on public.cursos to authenticated;
create policy cursos_admin on public.cursos for all to authenticated
    using (fen.es_admin()) with check (fen.es_admin());

-- matriculas: el estudiante ve las suyas; el docente las de su curso y cambia el estado.
-- (Matricularse se hace con la función matricular(), que valida requisitos.)
create policy matriculas_ver on public.matriculas for select to authenticated
    using (user_id = auth.uid() or fen.es_docente(curso_id));
grant update (estado) on public.matriculas to authenticated;
create policy matriculas_estado on public.matriculas for update to authenticated
    using (fen.es_docente(curso_id)) with check (fen.es_docente(curso_id));

-- clases
create policy clases_ver on public.clases for select to authenticated
    using (fen.esta_matriculado(curso_id) or fen.es_docente(curso_id));
grant insert, update, delete on public.clases to authenticated;
create policy clases_docente on public.clases for all to authenticated
    using (fen.es_docente(curso_id)) with check (fen.es_docente(curso_id));

-- actividades: el estudiante solo ve las publicadas de sus cursos.
create policy actividades_ver on public.actividades for select to authenticated
    using ((publicada and fen.esta_matriculado(curso_id)) or fen.es_docente(curso_id));
grant insert, update, delete on public.actividades to authenticated;
create policy actividades_docente on public.actividades for all to authenticated
    using (fen.es_docente(curso_id)) with check (fen.es_docente(curso_id));

-- preguntas/opciones: solo el docente las ve directamente.
-- El estudiante las recibe con preguntas_examen() recién cuando empieza su intento.
create policy preguntas_docente on public.preguntas for all to authenticated
    using (fen.es_docente(fen.curso_de_actividad(actividad_id)))
    with check (fen.es_docente(fen.curso_de_actividad(actividad_id)));
grant insert, update, delete on public.preguntas to authenticated;

create policy opciones_docente on public.opciones for all to authenticated
    using (fen.es_docente(fen.curso_de_pregunta(pregunta_id)))
    with check (fen.es_docente(fen.curso_de_pregunta(pregunta_id)));
grant insert, update, delete on public.opciones to authenticated;

create policy claves_docente on public.claves for all to authenticated
    using (fen.es_docente(fen.curso_de_pregunta(pregunta_id)))
    with check (fen.es_docente(fen.curso_de_pregunta(pregunta_id)));
grant insert, update, delete on public.claves to authenticated;

-- entregas: cada estudiante ve las suyas; el docente las de su curso y las califica.
create policy entregas_ver on public.entregas for select to authenticated
    using (user_id = auth.uid() or fen.es_docente(fen.curso_de_actividad(actividad_id)));
grant update (estado, nota, retroalimentacion) on public.entregas to authenticated;
create policy entregas_calificar on public.entregas for update to authenticated
    using (fen.es_docente(fen.curso_de_actividad(actividad_id)))
    with check (fen.es_docente(fen.curso_de_actividad(actividad_id)));

create policy intentos_ver on public.intentos for select to authenticated
    using (user_id = auth.uid() or fen.es_docente(fen.curso_de_actividad(actividad_id)));

create policy respuestas_ver on public.respuestas for select to authenticated
    using (exists (select 1 from public.entregas e where e.id = entrega_id and
           (e.user_id = auth.uid() or fen.es_docente(fen.curso_de_actividad(e.actividad_id)))));

-- recursos
create policy recursos_ver on public.recursos for select to authenticated
    using (fen.esta_matriculado(curso_id) or fen.es_docente(curso_id));
grant insert, delete on public.recursos to authenticated;
create policy recursos_publicar on public.recursos for insert to authenticated
    with check (fen.es_docente(curso_id) and user_id = auth.uid());
create policy recursos_borrar on public.recursos for delete to authenticated
    using (fen.es_docente(curso_id));

-- -----------------------------------------------------------------------------
--  Funciones públicas (se llaman desde la página con supabase.rpc)
-- -----------------------------------------------------------------------------

-- Nivel 1 (o el más bajo del lenguaje) es libre. El nivel N exige aprobar el nivel
-- anterior que exista en ese lenguaje (si no hay nivel 4, el 5 pide el 3).
create function public.matricular(p_curso bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
    v_curso public.cursos;
    v_anterior int;
    v_requisito text;
begin
    if fen.mi_rol() is distinct from 'estudiante' then raise exception 'Solo los estudiantes se matriculan.'; end if;
    select * into v_curso from public.cursos where id = p_curso;
    if not found then raise exception 'El curso no existe.'; end if;
    if fen.esta_matriculado(p_curso) then return 'Ya estás matriculado en ese curso.'; end if;

    select max(nivel) into v_anterior from public.cursos
    where lower(lenguaje) = lower(v_curso.lenguaje) and nivel < v_curso.nivel;

    if v_anterior is not null and not exists (
        select 1 from public.matriculas m join public.cursos c on c.id = m.curso_id
        where m.user_id = auth.uid() and m.estado = 'Aprobado'
          and lower(c.lenguaje) = lower(v_curso.lenguaje) and c.nivel = v_anterior) then
        select string_agg(codigo || ' ' || nombre, ' o ') into v_requisito from public.cursos
        where lower(lenguaje) = lower(v_curso.lenguaje) and nivel = v_anterior;
        raise exception 'No podés matricular %. Requisito: aprobar %.', v_curso.nombre, v_requisito;
    end if;

    insert into public.matriculas (user_id, curso_id) values (auth.uid(), p_curso);
    return 'Te matriculaste en ' || v_curso.nombre || '.';
end $$;

-- Entrega de trabajo: archivo (ya subido al bucket) y/o enlace https.
create function public.entregar_trabajo(p_actividad bigint, p_archivo_path text, p_nombre_original text,
                                        p_enlace text, p_comentario text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    v_act public.actividades;
    v_estado text;
    v_ultima text;
    v_id bigint;
begin
    select * into v_act from public.actividades where id = p_actividad and publicada and tipo = 'entrega';
    if not found then raise exception 'La actividad no existe.'; end if;
    select estado into v_estado from public.matriculas where curso_id = v_act.curso_id and user_id = auth.uid();
    if v_estado is null then raise exception 'No estás matriculado en este curso.'; end if;
    if v_estado <> 'Cursando' then raise exception 'El curso ya fue cerrado por tu profesor.'; end if;

    select estado into v_ultima from public.entregas where actividad_id = p_actividad and user_id = auth.uid()
    order by fecha_entrega desc, id desc limit 1;
    if v_ultima = 'Aprobado' then raise exception 'Tu entrega ya fue aprobada.'; end if;

    p_enlace := nullif(trim(coalesce(p_enlace, '')), '');
    if p_archivo_path is null and p_enlace is null then
        raise exception 'Subí un archivo o pegá el enlace de tu repositorio.';
    end if;
    if p_enlace is not null and p_enlace !~* '^https?://[^\s]+$' then
        raise exception 'El enlace debe empezar con https:// (ej. https://github.com/usuario/proyecto).';
    end if;
    -- El archivo tiene que estar en la carpeta del propio estudiante para esa actividad.
    if p_archivo_path is not null and p_archivo_path not like 'entregas/' || p_actividad || '/' || auth.uid() || '/%' then
        raise exception 'Ruta de archivo inválida.';
    end if;

    insert into public.entregas (actividad_id, user_id, archivo_path, nombre_original, enlace, comentario, fuera_de_tiempo)
    values (p_actividad, auth.uid(), p_archivo_path, p_nombre_original, p_enlace,
            nullif(trim(coalesce(p_comentario, '')), ''),
            v_act.fecha_limite is not null and current_date > v_act.fecha_limite)
    returning id into v_id;
    return v_id;
end $$;

-- Si el tiempo de un examen se agotó sin enviar, lo cierra con nota 0.
create function fen.cerrar_si_vencio(p_intento public.intentos) returns void
language plpgsql security definer set search_path = '' as $$
declare
    v_dur int;
    v_entrega bigint;
begin
    if p_intento.entrega_id is not null then return; end if;
    select duracion_minutos into v_dur from public.actividades where id = p_intento.actividad_id;
    if v_dur is null or now() <= p_intento.inicio + make_interval(mins => v_dur + 1) then return; end if;

    insert into public.entregas (actividad_id, user_id, estado, nota, fuera_de_tiempo, comentario)
    values (p_intento.actividad_id, p_intento.user_id, 'Revisado', 0, true, 'Tiempo agotado sin enviar respuestas.')
    returning id into v_entrega;
    update public.intentos set entrega_id = v_entrega where id = p_intento.id;
end $$;

-- Estado del examen para el estudiante: si puede empezar, si está en curso o ya terminó.
create function public.estado_examen(p_actividad bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    v_act public.actividades;
    v_mat text;
    v_int public.intentos;
    v_preg int;
    v_puntos numeric;
    v_motivo text;
begin
    select * into v_act from public.actividades where id = p_actividad and tipo = 'examen' and publicada;
    if not found then raise exception 'El examen no existe.'; end if;
    select estado into v_mat from public.matriculas where curso_id = v_act.curso_id and user_id = auth.uid();
    if v_mat is null then raise exception 'No estás matriculado en este curso.'; end if;

    select * into v_int from public.intentos where actividad_id = p_actividad and user_id = auth.uid();
    if found then
        perform fen.cerrar_si_vencio(v_int);
        select * into v_int from public.intentos where id = v_int.id;
    end if;
    select count(*), coalesce(sum(puntos), 0) into v_preg, v_puntos from public.preguntas where actividad_id = p_actividad;

    v_motivo := case
        when v_int.entrega_id is not null then 'Ya rendiste este examen.'
        when v_mat <> 'Cursando' then 'El curso ya fue cerrado por tu profesor.'
        when v_int.id is null and v_act.fecha_limite is not null and current_date > v_act.fecha_limite then 'La fecha límite del examen ya pasó.'
        when v_preg = 0 then 'El examen todavía no tiene preguntas.'
    end;

    return jsonb_build_object(
        'preguntas', v_preg, 'puntos', v_puntos,
        'iniciado', v_int.id is not null, 'entrega_id', v_int.entrega_id,
        'vence', case when v_int.id is not null and v_act.duracion_minutos is not null
                      then v_int.inicio + make_interval(mins => v_act.duracion_minutos) end,
        'ahora', now(),
        'puede_rendir', v_motivo is null, 'motivo', v_motivo);
end $$;

create function public.comenzar_examen(p_actividad bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
    v_estado jsonb := public.estado_examen(p_actividad);
begin
    if not (v_estado ->> 'puede_rendir')::boolean then raise exception '%', v_estado ->> 'motivo'; end if;
    insert into public.intentos (actividad_id, user_id) values (p_actividad, auth.uid())
    on conflict (actividad_id, user_id) do nothing;
end $$;

-- Preguntas y opciones (sin respuestas correctas), solo con el intento en curso.
create function public.preguntas_examen(p_actividad bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
    if not exists (select 1 from public.intentos where actividad_id = p_actividad and user_id = auth.uid() and entrega_id is null) then
        raise exception 'Primero tenés que comenzar el examen.';
    end if;
    return (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'orden', p.orden, 'enunciado', p.enunciado, 'tipo', p.tipo, 'puntos', p.puntos,
            'opciones', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto) order by o.id), '[]')
                         from public.opciones o where o.pregunta_id = p.id)) order by p.orden, p.id), '[]')
        from public.preguntas p where p.actividad_id = p_actividad);
end $$;

-- Corrige y guarda el examen. p_respuestas = {"<pregunta_id>": "<opcion_id o texto>", ...}
create function public.enviar_examen(p_actividad bigint, p_respuestas jsonb) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
    v_int public.intentos;
    v_dur int;
    v_entrega bigint;
    v_preg record;
    v_valor text;
    v_opcion bigint;
begin
    select * into v_int from public.intentos where actividad_id = p_actividad and user_id = auth.uid() for update;
    if not found then raise exception 'Primero tenés que comenzar el examen.'; end if;
    if v_int.entrega_id is not null then raise exception 'Ya enviaste este examen.'; end if;
    select duracion_minutos into v_dur from public.actividades where id = p_actividad;

    insert into public.entregas (actividad_id, user_id, estado, fuera_de_tiempo)
    values (p_actividad, auth.uid(), 'Revisado',
            v_dur is not null and now() > v_int.inicio + make_interval(mins => v_dur + 1))
    returning id into v_entrega;

    for v_preg in
        select p.id, p.tipo, k.opcion_correcta_id, k.respuestas_aceptadas
        from public.preguntas p left join public.claves k on k.pregunta_id = p.id
        where p.actividad_id = p_actividad
    loop
        v_valor := left(coalesce(p_respuestas ->> v_preg.id::text, ''), 500);
        if v_preg.tipo = 'opcion_unica' then
            select id into v_opcion from public.opciones
            where pregunta_id = v_preg.id and id = fen.es_numero(v_valor)::bigint;
            insert into public.respuestas (entrega_id, pregunta_id, opcion_id, correcta)
            values (v_entrega, v_preg.id, v_opcion, v_opcion is not null and v_opcion = v_preg.opcion_correcta_id);
        else
            insert into public.respuestas (entrega_id, pregunta_id, texto, correcta)
            values (v_entrega, v_preg.id, v_valor, fen.respuesta_corta_correcta(v_preg.respuestas_aceptadas, v_valor));
        end if;
    end loop;

    update public.intentos set entrega_id = v_entrega where id = v_int.id;
    return fen.recalcular_nota(v_entrega);
end $$;

-- Corrección completa (con respuestas correctas) para el estudiante después de enviar,
-- solo si el profesor lo permite; el docente la ve siempre.
create function public.solucion_examen(p_actividad bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    v_act public.actividades;
begin
    select * into v_act from public.actividades where id = p_actividad and tipo = 'examen';
    if not found then raise exception 'El examen no existe.'; end if;
    if not fen.es_docente(v_act.curso_id) and not (
        v_act.mostrar_solucion and exists (
            select 1 from public.intentos where actividad_id = p_actividad and user_id = auth.uid() and entrega_id is not null)) then
        return null;
    end if;
    return (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'orden', p.orden, 'enunciado', p.enunciado, 'tipo', p.tipo, 'puntos', p.puntos,
            'opcion_correcta_id', k.opcion_correcta_id, 'respuestas_aceptadas', k.respuestas_aceptadas,
            'opciones', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto) order by o.id), '[]')
                         from public.opciones o where o.pregunta_id = p.id)) order by p.orden, p.id), '[]')
        from public.preguntas p left join public.claves k on k.pregunta_id = p.id
        where p.actividad_id = p_actividad);
end $$;

-- Crea una pregunta completa de una vez (pregunta + opciones + clave).
-- p_opciones: lista de textos; p_correcta: índice (0, 1, ...) de la correcta.
create function public.guardar_pregunta(p_actividad bigint, p_enunciado text, p_tipo text, p_puntos numeric,
                                        p_opciones text[], p_correcta int, p_aceptadas text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    v_curso bigint := fen.curso_de_actividad(p_actividad);
    v_preg bigint;
    v_op bigint;
    v_correcta bigint;
    i int;
begin
    if v_curso is null or not fen.es_docente(v_curso) then raise exception 'No tenés permiso sobre este examen.'; end if;
    if coalesce(trim(p_enunciado), '') = '' then raise exception 'Escribí el enunciado de la pregunta.'; end if;
    if p_tipo = 'opcion_unica' then
        if coalesce(array_length(p_opciones, 1), 0) < 2 then raise exception 'Escribí al menos 2 opciones.'; end if;
        if p_correcta is null or p_correcta < 0 or p_correcta >= array_length(p_opciones, 1) then
            raise exception 'Marcá exactamente UNA opción correcta.';
        end if;
    elsif p_tipo = 'respuesta_corta' then
        if coalesce(trim(p_aceptadas), '') = '' then raise exception 'Escribí al menos una respuesta aceptada.'; end if;
    else
        raise exception 'Tipo de pregunta inválido.';
    end if;

    insert into public.preguntas (actividad_id, orden, enunciado, tipo, puntos)
    values (p_actividad, coalesce((select max(orden) from public.preguntas where actividad_id = p_actividad), 0) + 1,
            trim(p_enunciado), p_tipo, p_puntos)
    returning id into v_preg;

    if p_tipo = 'opcion_unica' then
        for i in 1 .. array_length(p_opciones, 1) loop
            insert into public.opciones (pregunta_id, texto) values (v_preg, trim(p_opciones[i])) returning id into v_op;
            if i - 1 = p_correcta then v_correcta := v_op; end if;
        end loop;
        insert into public.claves (pregunta_id, opcion_correcta_id) values (v_preg, v_correcta);
    else
        insert into public.claves (pregunta_id, respuestas_aceptadas) values (v_preg, trim(p_aceptadas));
    end if;
    return v_preg;
end $$;

-- El docente acepta (o anula) una respuesta y la nota se recalcula.
create function public.cambiar_correccion(p_respuesta bigint, p_correcta boolean) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
    v_entrega bigint;
    v_actividad bigint;
begin
    select r.entrega_id, e.actividad_id into v_entrega, v_actividad
    from public.respuestas r join public.entregas e on e.id = r.entrega_id where r.id = p_respuesta;
    if v_entrega is null or not fen.es_docente(fen.curso_de_actividad(v_actividad)) then
        raise exception 'No tenés permiso sobre esta respuesta.';
    end if;
    update public.respuestas set correcta = p_correcta, corregida_manual = true where id = p_respuesta;
    return fen.recalcular_nota(v_entrega);
end $$;

create function public.admin_cambiar_rol(p_usuario uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if not fen.es_admin() then raise exception 'Solo un administrador puede cambiar roles.'; end if;
    if p_usuario = auth.uid() then raise exception 'No podés cambiar tu propio rol.'; end if;
    if p_rol not in ('estudiante', 'profesor', 'admin') then raise exception 'Rol inválido.'; end if;
    update public.perfiles set rol = p_rol where id = p_usuario;
    if p_rol <> 'profesor' then
        update public.cursos set profesor_id = null where profesor_id = p_usuario;
    end if;
end $$;

create function public.mi_perfil() returns jsonb
language sql stable security definer set search_path = '' as $$
    select to_jsonb(p) from public.perfiles p where id = auth.uid()
$$;

-- Para el formulario de registro (se puede usar sin sesión).
create function public.usuario_disponible(p_usuario text) returns boolean
language sql stable security definer set search_path = '' as $$
    select not exists (select 1 from public.perfiles where lower(usuario) = lower(trim(p_usuario)))
$$;

create function public.admin_usuarios() returns setof public.perfiles
language plpgsql stable security definer set search_path = '' as $$
begin
    if not fen.es_admin() then raise exception 'Solo un administrador puede ver los usuarios.'; end if;
    return query select * from public.perfiles order by rol, nombre;
end $$;

create function public.admin_eliminar_usuario(p_usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if not fen.es_admin() then raise exception 'Solo un administrador puede eliminar usuarios.'; end if;
    if p_usuario = auth.uid() then raise exception 'No podés eliminar tu propia cuenta.'; end if;
    delete from auth.users where id = p_usuario;   -- borra en cascada perfil, matrículas y entregas
end $$;

-- Las funciones públicas solo para usuarios con sesión.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.usuario_disponible(text) to anon;
revoke execute on all functions in schema fen from public, anon;
grant execute on all functions in schema fen to authenticated;

-- -----------------------------------------------------------------------------
--  Archivos (Supabase Storage): bucket privado "archivos"
--    entregas/<actividad>/<usuario>/<archivo>   recursos/<curso>/<archivo>
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 16777216)
on conflict (id) do update set public = false, file_size_limit = 16777216;

drop policy if exists fen_archivos_subir on storage.objects;
drop policy if exists fen_archivos_ver on storage.objects;
drop policy if exists fen_archivos_borrar on storage.objects;

create function fen.puede_subir(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
    select case (storage.foldername(p_nombre))[1]
        when 'entregas' then
            (storage.foldername(p_nombre))[3] = auth.uid()::text
            and fen.esta_matriculado(fen.curso_de_actividad(fen.es_numero((storage.foldername(p_nombre))[2])::bigint))
        when 'recursos' then
            fen.es_docente(fen.es_numero((storage.foldername(p_nombre))[2])::bigint)
        else false end
$$;

create function fen.puede_ver(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
    select case (storage.foldername(p_nombre))[1]
        when 'entregas' then
            (storage.foldername(p_nombre))[3] = auth.uid()::text
            or fen.es_docente(fen.curso_de_actividad(fen.es_numero((storage.foldername(p_nombre))[2])::bigint))
        when 'recursos' then
            fen.esta_matriculado(fen.es_numero((storage.foldername(p_nombre))[2])::bigint)
            or fen.es_docente(fen.es_numero((storage.foldername(p_nombre))[2])::bigint)
        else false end
$$;

-- Borrar: el docente (al eliminar recursos o actividades) o el admin.
create function fen.puede_borrar(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
    select case (storage.foldername(p_nombre))[1]
        when 'entregas' then fen.es_docente(fen.curso_de_actividad(fen.es_numero((storage.foldername(p_nombre))[2])::bigint))
        when 'recursos' then fen.es_docente(fen.es_numero((storage.foldername(p_nombre))[2])::bigint)
        else false end
$$;
grant execute on function fen.puede_subir, fen.puede_ver, fen.puede_borrar to authenticated;

create policy fen_archivos_subir on storage.objects for insert to authenticated
    with check (bucket_id = 'archivos' and fen.puede_subir(name));
create policy fen_archivos_ver on storage.objects for select to authenticated
    using (bucket_id = 'archivos' and fen.puede_ver(name));
create policy fen_archivos_borrar on storage.objects for delete to authenticated
    using (bucket_id = 'archivos' and fen.puede_borrar(name));

-- -----------------------------------------------------------------------------
--  Datos de ejemplo: 5 materias con sus clases y actividades en PY-1.
--  Quedan sin profesor; el admin los asigna desde la página.
-- -----------------------------------------------------------------------------

do $$
declare
    v_curso bigint;
    v_examen bigint;
    v_preg bigint;
    v_op bigint;
    c jsonb;
    cl jsonb;
    i int;
begin
    for c in select * from jsonb_array_elements($j$[
      {"codigo":"PY-1","nombre":"Python desde cero","lenguaje":"Python","nivel":1,
       "descripcion":"Primeros pasos: variables, tipos de datos, condicionales y bucles.",
       "clases":[["¿Qué es programar?","Algoritmos, instalación de Python, el intérprete y el primer print()."],
                 ["Variables y tipos","int, float, str y bool. Leer datos con input() y convertir con int() / float()."],
                 ["Condicionales","if, elif, else. Operadores de comparación y lógicos (and, or, not)."],
                 ["Bucles","while y for con range(). Contadores, acumuladores y break."]]},
      {"codigo":"PY-2","nombre":"Python intermedio","lenguaje":"Python","nivel":2,
       "descripcion":"Funciones, colecciones y archivos.",
       "clases":[["Funciones","def, parámetros, return y alcance de variables."],
                 ["Listas y tuplas","Índices, slicing, métodos de lista y recorridos."],
                 ["Diccionarios y conjuntos","Clave-valor, .get(), .items() y operaciones de conjuntos."],
                 ["Archivos y errores","open(), with, lectura/escritura y try / except."]]},
      {"codigo":"PY-3","nombre":"Python avanzado","lenguaje":"Python","nivel":3,
       "descripcion":"Programación orientada a objetos, módulos y pruebas.",
       "clases":[["Clases y objetos","class, __init__, atributos y métodos."],
                 ["Herencia y polimorfismo","Subclases, super() y sobrescritura de métodos."],
                 ["Módulos y paquetes","import, entornos virtuales y pip."],
                 ["Pruebas","assert y pytest para comprobar que el código funciona."]]},
      {"codigo":"JS-1","nombre":"JavaScript básico","lenguaje":"JavaScript","nivel":1,
       "descripcion":"Sintaxis del lenguaje y primeros pasos en el navegador.",
       "clases":[["JavaScript en el navegador","La consola, <script> y console.log()."],
                 ["Variables y tipos","let, const, number, string, boolean y conversiones."],
                 ["Condicionales y bucles","if/else, for, while y operadores."],
                 ["El DOM","querySelector, textContent y eventos con addEventListener."]]},
      {"codigo":"JS-2","nombre":"JavaScript intermedio","lenguaje":"JavaScript","nivel":2,
       "descripcion":"Funciones modernas, arrays y peticiones a APIs.",
       "clases":[["Funciones flecha","Sintaxis =>, parámetros por defecto y callbacks."],
                 ["Arrays","map, filter, reduce y find."],
                 ["Objetos y JSON","Desestructuración, spread y JSON.parse / stringify."],
                 ["fetch y async/await","Pedir datos a una API y mostrarlos en la página."]]}
    ]$j$::jsonb)
    loop
        insert into public.cursos (codigo, nombre, lenguaje, nivel, descripcion)
        values (c->>'codigo', c->>'nombre', c->>'lenguaje', (c->>'nivel')::int, c->>'descripcion')
        returning id into v_curso;
        i := 0;
        for cl in select * from jsonb_array_elements(c->'clases') loop
            i := i + 1;
            insert into public.clases (curso_id, titulo, descripcion, orden) values (v_curso, cl->>0, cl->>1, i);
        end loop;
    end loop;

    select id into v_curso from public.cursos where codigo = 'PY-1';
    insert into public.actividades (curso_id, clase_id, tipo, titulo, descripcion, fecha_limite, valor)
    values (v_curso, (select id from public.clases where curso_id = v_curso and orden = 2), 'entrega',
            'Calculadora de edad', 'Pedí el año de nacimiento y mostrá la edad. Subí el archivo .py o el enlace a tu repositorio de GitHub.',
            current_date + 14, 30),
           (v_curso, (select id from public.clases where curso_id = v_curso and orden = 3), 'entrega',
            '¿Par o impar?', 'Leé un número entero e indicá si es par o impar usando el operador %.',
            current_date + 21, 30);

    insert into public.actividades (curso_id, tipo, titulo, descripcion, fecha_limite, valor, publicada, duracion_minutos, mostrar_solucion)
    values (v_curso, 'examen', 'Examen parcial: fundamentos',
            'Preguntas de opción única y de respuesta corta. Tenés un solo intento.', current_date + 28, 40, false, 20, true)
    returning id into v_examen;

    -- Opción única: la primera opción de cada lista es la correcta (al estudiante se le muestran mezcladas).
    for c in select * from jsonb_array_elements($j$[
        ["¿Qué función muestra texto en pantalla en Python?", "print()", "input()", "echo()", "show()"],
        ["¿Qué tipo de dato es 3.14?", "float", "int", "str", "bool"]]$j$::jsonb)
    loop
        insert into public.preguntas (actividad_id, orden, enunciado, tipo)
        values (v_examen, (select count(*) + 1 from public.preguntas where actividad_id = v_examen), c->>0, 'opcion_unica')
        returning id into v_preg;
        for i in 1 .. jsonb_array_length(c) - 1 loop
            insert into public.opciones (pregunta_id, texto) values (v_preg, c->>i) returning id into v_op;
            if i = 1 then insert into public.claves (pregunta_id, opcion_correcta_id) values (v_preg, v_op); end if;
        end loop;
    end loop;

    insert into public.preguntas (actividad_id, orden, enunciado, tipo) values
        (v_examen, 3, '¿Qué imprime print(7 // 2)?', 'respuesta_corta') returning id into v_preg;
    insert into public.claves (pregunta_id, respuestas_aceptadas) values (v_preg, '3');
    insert into public.preguntas (actividad_id, orden, enunciado, tipo) values
        (v_examen, 4, '¿Qué palabra clave se usa para una condición alternativa después de if (antes de else)?', 'respuesta_corta')
        returning id into v_preg;
    insert into public.claves (pregunta_id, respuestas_aceptadas) values (v_preg, 'elif');

    update public.actividades set publicada = true where id = v_examen;
end $$;

-- Listo. Último paso (una sola vez): registrate en la página y convertite en admin con
--   update public.perfiles set rol = 'admin' where email = 'tu-correo@ejemplo.com';

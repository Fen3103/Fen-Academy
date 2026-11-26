-- =============================================================================
--  Mejoras del aula:
--   - Editar y reordenar preguntas de examen (mientras nadie haya empezado).
--   - Anuncios por curso.
--   - Fecha de creación de actividades y fecha de revisión de entregas
--     (para mostrar novedades: "nueva tarea", "te calificaron").
-- =============================================================================

-- ---------------------------------------------------------------- fechas ---
alter table public.actividades add column if not exists creada timestamptz not null default now();
alter table public.entregas   add column if not exists fecha_revision timestamptz;

create or replace function fen.marcar_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.nota is distinct from old.nota or new.estado is distinct from old.estado
       or new.retroalimentacion is distinct from old.retroalimentacion then
        new.fecha_revision := now();
    end if;
    return new;
end $$;

drop trigger if exists marcar_revision on public.entregas;
create trigger marcar_revision before update on public.entregas
    for each row execute function fen.marcar_revision();

-- ------------------------------------------------------- editar preguntas ---
create or replace function public.editar_pregunta(p_pregunta bigint, p_enunciado text, p_tipo text, p_puntos numeric,
                                                  p_opciones text[], p_correcta int, p_aceptadas text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
    v_preg public.preguntas;
    v_op bigint;
    v_correcta bigint;
    i int;
begin
    select * into v_preg from public.preguntas where id = p_pregunta;
    if not found or not fen.es_docente(fen.curso_de_actividad(v_preg.actividad_id)) then
        raise exception 'No tenés permiso sobre esta pregunta.';
    end if;
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

    -- Los triggers bloquean todo esto si ya hay intentos.
    update public.preguntas set enunciado = trim(p_enunciado), tipo = p_tipo, puntos = p_puntos where id = p_pregunta;
    delete from public.claves where pregunta_id = p_pregunta;
    delete from public.opciones where pregunta_id = p_pregunta;

    if p_tipo = 'opcion_unica' then
        for i in 1 .. array_length(p_opciones, 1) loop
            insert into public.opciones (pregunta_id, texto) values (p_pregunta, trim(p_opciones[i])) returning id into v_op;
            if i - 1 = p_correcta then v_correcta := v_op; end if;
        end loop;
        insert into public.claves (pregunta_id, opcion_correcta_id) values (p_pregunta, v_correcta);
    else
        insert into public.claves (pregunta_id, respuestas_aceptadas) values (p_pregunta, trim(p_aceptadas));
    end if;
    return p_pregunta;
end $$;

-- Sube (-1) o baja (+1) una pregunta un lugar.
create or replace function public.mover_pregunta(p_pregunta bigint, p_direccion int) returns void
language plpgsql security definer set search_path = '' as $$
declare
    v_preg public.preguntas;
    v_otra public.preguntas;
begin
    select * into v_preg from public.preguntas where id = p_pregunta;
    if not found or not fen.es_docente(fen.curso_de_actividad(v_preg.actividad_id)) then
        raise exception 'No tenés permiso sobre esta pregunta.';
    end if;
    if p_direccion < 0 then
        select * into v_otra from public.preguntas where actividad_id = v_preg.actividad_id and orden < v_preg.orden order by orden desc limit 1;
    else
        select * into v_otra from public.preguntas where actividad_id = v_preg.actividad_id and orden > v_preg.orden order by orden limit 1;
    end if;
    if not found then return; end if;
    update public.preguntas set orden = v_otra.orden where id = v_preg.id;
    update public.preguntas set orden = v_preg.orden where id = v_otra.id;
end $$;

revoke execute on function public.editar_pregunta(bigint, text, text, numeric, text[], int, text), public.mover_pregunta(bigint, int) from public, anon;
grant execute on function public.editar_pregunta(bigint, text, text, numeric, text[], int, text), public.mover_pregunta(bigint, int) to authenticated;

-- ---------------------------------------------------------------- anuncios ---
create table if not exists public.anuncios (
    id       bigint generated always as identity primary key,
    curso_id bigint not null references public.cursos (id) on delete cascade,
    autor_id uuid references public.perfiles (id) on delete set null default auth.uid(),
    titulo   text not null,
    texto    text,
    fecha    timestamptz not null default now()
);
create index if not exists anuncios_curso on public.anuncios (curso_id, fecha desc);

alter table public.anuncios enable row level security;
revoke all on public.anuncios from anon;
grant select, insert, update, delete on public.anuncios to authenticated;

create policy anuncios_ver on public.anuncios for select to authenticated
    using (fen.esta_matriculado(curso_id) or fen.es_docente(curso_id));
create policy anuncios_docente on public.anuncios for all to authenticated
    using (fen.es_docente(curso_id)) with check (fen.es_docente(curso_id));

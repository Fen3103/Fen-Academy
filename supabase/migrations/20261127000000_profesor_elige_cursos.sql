-- =============================================================================
--  El profesor elige qué cursos da.
--   - Ve el catálogo, toma los cursos libres y puede dejarlos.
--   - Puede crear sus propios cursos y editar los que da.
--   - Los estudiantes solo se matriculan en cursos que tienen profesor;
--     los requisitos por nivel se calculan solo con esos cursos activos.
-- =============================================================================

-- El profesor crea cursos a su nombre.
create policy cursos_profesor_crear on public.cursos for insert to authenticated
    with check (fen.mi_rol() = 'profesor' and profesor_id = auth.uid());

-- Edita los cursos que da (no puede pasárselos a otro: para eso está dejar_curso).
create policy cursos_profesor_editar on public.cursos for update to authenticated
    using (fen.mi_rol() = 'profesor' and profesor_id = auth.uid())
    with check (profesor_id = auth.uid());

-- Borra un curso suyo solo si todavía no tiene estudiantes.
create policy cursos_profesor_borrar on public.cursos for delete to authenticated
    using (fen.mi_rol() = 'profesor' and profesor_id = auth.uid()
           and not exists (select 1 from public.matriculas m where m.curso_id = cursos.id));

create function public.tomar_curso(p_curso bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
    v_curso public.cursos;
begin
    if fen.mi_rol() is distinct from 'profesor' then raise exception 'Solo los profesores eligen cursos.'; end if;
    select * into v_curso from public.cursos where id = p_curso for update;
    if not found then raise exception 'El curso no existe.'; end if;
    if v_curso.profesor_id = auth.uid() then return 'Ya das este curso.'; end if;
    if v_curso.profesor_id is not null then raise exception 'Ese curso ya lo da otro profesor.'; end if;
    update public.cursos set profesor_id = auth.uid() where id = p_curso;
    return 'Ahora das ' || v_curso.codigo || ' · ' || v_curso.nombre || '.';
end $$;

create function public.dejar_curso(p_curso bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
    v_curso public.cursos;
begin
    select * into v_curso from public.cursos where id = p_curso and profesor_id = auth.uid();
    if not found then raise exception 'No das ese curso.'; end if;
    update public.cursos set profesor_id = null where id = p_curso;
    return 'Dejaste ' || v_curso.codigo || '. Sus clases y notas se conservan si lo volvés a tomar.';
end $$;

-- Matrícula: solo en cursos con profesor; el requisito es el nivel anterior ACTIVO del mismo lenguaje.
create or replace function public.matricular(p_curso bigint) returns text
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
    if v_curso.profesor_id is null then raise exception 'Ese curso todavía no tiene profesor.'; end if;

    select max(nivel) into v_anterior from public.cursos
    where lower(lenguaje) = lower(v_curso.lenguaje) and nivel < v_curso.nivel and profesor_id is not null;

    if v_anterior is not null and not exists (
        select 1 from public.matriculas m join public.cursos c on c.id = m.curso_id
        where m.user_id = auth.uid() and m.estado = 'Aprobado'
          and lower(c.lenguaje) = lower(v_curso.lenguaje) and c.nivel = v_anterior) then
        select string_agg(codigo || ' ' || nombre, ' o ') into v_requisito from public.cursos
        where lower(lenguaje) = lower(v_curso.lenguaje) and nivel = v_anterior and profesor_id is not null;
        raise exception 'No podés matricular %. Requisito: aprobar %.', v_curso.nombre, v_requisito;
    end if;

    insert into public.matriculas (user_id, curso_id) values (auth.uid(), p_curso);
    return 'Te matriculaste en ' || v_curso.nombre || '.';
end $$;

revoke execute on function public.tomar_curso(bigint), public.dejar_curso(bigint), public.matricular(bigint) from public, anon;
grant execute on function public.tomar_curso(bigint), public.dejar_curso(bigint), public.matricular(bigint) to authenticated;

-- =============================================================================
--  Estado de la matrícula automático, por fechas y nota.
--   - Cada curso tiene fecha de inicio, fecha de fin y nota mínima para aprobar
--     (las ajusta el profesor; por defecto no hay fechas y la mínima es 70).
--   - Hasta la fecha de fin el estudiante está "Cursando". Después, su nota
--     final decide: "Aprobado" si llega a la mínima, si no "Reprobado".
--   - Antes de la fecha de inicio la interfaz lo muestra como "Por iniciar"
--     (en la base sigue como Cursando).
--   - El profesor ya no cambia el estado a mano, y puede quitar estudiantes.
-- =============================================================================

alter table public.cursos add column if not exists fecha_inicio date;
alter table public.cursos add column if not exists fecha_fin    date;
alter table public.cursos add column if not exists nota_minima  numeric(5,2) not null default 70;
alter table public.cursos drop constraint if exists cursos_fechas_ok;
alter table public.cursos add constraint cursos_fechas_ok
    check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio);
alter table public.cursos drop constraint if exists cursos_nota_minima_ok;
alter table public.cursos add constraint cursos_nota_minima_ok check (nota_minima between 0 and 100);

-- Nota final de un estudiante: suma de (nota de su última entrega × valor / 100)
-- en las actividades publicadas del curso. Igual que la "nota acumulada" de la web.
create or replace function fen.nota_curso(p_curso bigint, p_user uuid) returns numeric
language sql stable security definer set search_path = '' as $$
    select coalesce(round(sum(u.nota * a.valor / 100), 2), 0)
    from public.actividades a
    join lateral (
        select e.nota from public.entregas e
        where e.actividad_id = a.id and e.user_id = p_user
        order by e.fecha_entrega desc, e.id desc
        limit 1
    ) u on true
    where a.curso_id = p_curso and a.publicada and u.nota is not null;
$$;

create or replace function fen.estado_calculado(p_curso bigint, p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
    select case
        when c.fecha_fin is not null and current_date > c.fecha_fin then
            case when fen.nota_curso(p_curso, p_user) >= c.nota_minima then 'Aprobado' else 'Reprobado' end
        else 'Cursando'
    end
    from public.cursos c where c.id = p_curso;
$$;

-- Recalcula y guarda el estado (lo usan los requisitos de nivel, las entregas y los exámenes).
create or replace function fen.sincronizar_matriculas(p_curso bigint, p_user uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
    update public.matriculas m
       set estado = fen.estado_calculado(m.curso_id, m.user_id)
     where m.curso_id = p_curso
       and (p_user is null or m.user_id = p_user)
       and m.estado is distinct from fen.estado_calculado(m.curso_id, m.user_id);
end $$;

-- La fecha de fin pasa sola: la web llama a esto al entrar para poner al día
-- los cursos del usuario (los suyos como estudiante y los que da).
create or replace function public.sincronizar_estados() returns void
language plpgsql security definer set search_path = '' as $$
declare
    v_curso bigint;
begin
    if auth.uid() is null then return; end if;
    for v_curso in
        select curso_id from public.matriculas where user_id = auth.uid()
        union
        select id from public.cursos where profesor_id = auth.uid()
    loop
        perform fen.sincronizar_matriculas(v_curso);
    end loop;
end $$;
revoke all on function public.sincronizar_estados() from public, anon;
grant execute on function public.sincronizar_estados() to authenticated;
revoke all on function fen.nota_curso(bigint, uuid) from public, anon;
revoke all on function fen.estado_calculado(bigint, uuid) from public, anon;
revoke all on function fen.sincronizar_matriculas(bigint, uuid) from public, anon;
grant execute on function fen.nota_curso(bigint, uuid) to authenticated;
grant execute on function fen.estado_calculado(bigint, uuid) to authenticated;

-- Disparadores: el estado se recalcula cuando cambia algo que lo afecta.
create or replace function fen.tr_estado_por_curso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    perform fen.sincronizar_matriculas(new.id);
    return null;
end $$;
drop trigger if exists estado_por_curso on public.cursos;
create trigger estado_por_curso after update of fecha_inicio, fecha_fin, nota_minima on public.cursos
    for each row execute function fen.tr_estado_por_curso();

create or replace function fen.tr_estado_por_actividad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    perform fen.sincronizar_matriculas(coalesce(new.curso_id, old.curso_id));
    return null;
end $$;
drop trigger if exists estado_por_actividad on public.actividades;
create trigger estado_por_actividad after insert or delete or update of valor, publicada on public.actividades
    for each row execute function fen.tr_estado_por_actividad();

create or replace function fen.tr_estado_por_entrega() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    perform fen.sincronizar_matriculas(fen.curso_de_actividad(coalesce(new.actividad_id, old.actividad_id)),
                                       coalesce(new.user_id, old.user_id));
    return null;
end $$;
drop trigger if exists estado_por_entrega on public.entregas;
create trigger estado_por_entrega after insert or delete or update of nota on public.entregas
    for each row execute function fen.tr_estado_por_entrega();

-- Al matricularse ya entra con el estado que corresponde (por si el curso terminó).
create or replace function fen.tr_estado_al_matricular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    new.estado := fen.estado_calculado(new.curso_id, new.user_id);
    return new;
end $$;
drop trigger if exists estado_al_matricular on public.matriculas;
create trigger estado_al_matricular before insert on public.matriculas
    for each row execute function fen.tr_estado_al_matricular();

-- El estado ya no se cambia a mano.
drop policy if exists matriculas_estado on public.matriculas;
revoke update (estado) on public.matriculas from authenticated;

-- El profesor puede quitar estudiantes de su curso (las entregas se conservan:
-- si el estudiante vuelve a matricularse, recupera su historial).
grant delete on public.matriculas to authenticated;
drop policy if exists matriculas_docente_quitar on public.matriculas;
create policy matriculas_docente_quitar on public.matriculas for delete to authenticated
    using (fen.es_docente(curso_id));

-- Pone al día los estados actuales.
do $$
declare v bigint;
begin
    for v in select id from public.cursos loop perform fen.sincronizar_matriculas(v); end loop;
end $$;

-- Database voor de tennistoernooi-app.
-- Plak dit hele bestand in Supabase onder SQL Editor en klik op Run.

-- ---------- Tabellen ----------

create table spelers (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  niveau text not null check (niveau in ('ervaren', 'beginner')),
  actief boolean not null default true
);

create table wedstrijden (
  id uuid primary key default gen_random_uuid(),
  ronde int not null,
  baan int not null,
  -- Een plek is het id van een speler, of een verwijzing zoals '@W:1:2:0'
  -- (winnaar van ronde 1, baan 2, eerste speler van dat team)
  team1_a text not null,
  team1_b text not null,
  team2_a text not null,
  team2_b text not null,
  score1 int,
  score2 int,
  -- Alleen nodig bij een gelijke stand: wie won het winnende punt (team 1 of 2)
  winnaar int check (winnaar in (1, 2)),
  unique (ronde, baan)
);

-- Wie mag er wijzigen. Alleen accounts in deze tabel kunnen schrijven.
create table beheerders (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------- Toegangsregels ----------

alter table spelers enable row level security;
alter table wedstrijden enable row level security;
alter table beheerders enable row level security;

-- Iedereen mag meekijken
create policy "Iedereen mag spelers lezen" on spelers for select using (true);
create policy "Iedereen mag wedstrijden lezen" on wedstrijden for select using (true);

-- Een ingelogde gebruiker mag alleen zien of hij zelf beheerder is
create policy "Eigen beheerdersrij lezen" on beheerders for select to authenticated
  using (user_id = (select auth.uid()));

-- Alleen beheerders mogen toevoegen, wijzigen en verwijderen
create policy "Beheerder schrijft spelers" on spelers for all to authenticated
  using (exists (select 1 from beheerders where user_id = (select auth.uid())))
  with check (exists (select 1 from beheerders where user_id = (select auth.uid())));

create policy "Beheerder schrijft wedstrijden" on wedstrijden for all to authenticated
  using (exists (select 1 from beheerders where user_id = (select auth.uid())))
  with check (exists (select 1 from beheerders where user_id = (select auth.uid())));

-- ---------- Live updates ----------

alter publication supabase_realtime add table spelers, wedstrijden;

-- ---------- Jezelf beheerder maken ----------
-- Doe dit NA het aanmaken van je login (Authentication > Users > Add user).
-- Haal de twee streepjes weg, vul je eigen e-mailadres in en voer alleen deze regel uit:

-- insert into beheerders select id from auth.users where email = 'JOUW-EMAILADRES';

-- ---------- Deelnemers ----------

insert into spelers (naam, niveau) values
  ('Thijs', 'ervaren'), ('Stijn', 'ervaren'), ('Jesse', 'ervaren'),
  ('Demi', 'ervaren'), ('Sjoerd', 'ervaren'), ('Bart', 'ervaren'), ('Remco', 'ervaren'),
  ('Harvey', 'beginner'), ('Isis', 'beginner'), ('Lorenzo', 'beginner'), ('Kim', 'beginner'),
  ('Hein', 'beginner'), ('Max', 'beginner'), ('Steven', 'beginner');

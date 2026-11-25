// Run: PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node scripts/test-project-tools-db.mjs
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.actor',true),'')::uuid $$;
CREATE TABLE public.teams(id uuid PRIMARY KEY);
CREATE TABLE public.team_members(id uuid PRIMARY KEY,team_id uuid REFERENCES teams(id),status text,role text);
CREATE TABLE public.projects(id uuid PRIMARY KEY,team_id uuid REFERENCES teams(id),owner_id uuid,status text);
CREATE TABLE public.project_objectives(id uuid PRIMARY KEY,project_id uuid REFERENCES projects(id) ON DELETE CASCADE,team_id uuid);
CREATE TABLE public.project_members(project_id uuid,member_id uuid,team_id uuid);
CREATE FUNCTION public.get_my_team_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE((SELECT team_id FROM team_members WHERE id=auth.uid()),'00000000-0000-4000-8000-000000000001'::uuid) $$;
CREATE FUNCTION public.is_project_member(p uuid,u uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id=p AND member_id=u AND team_id=get_my_team_id()) $$;
CREATE FUNCTION public.is_team_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM team_members WHERE id=auth.uid() AND role='admin') $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT ON projects, team_members TO authenticated;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_read ON projects FOR SELECT TO authenticated USING(team_id=get_my_team_id());`)
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
await db.exec(`INSERT INTO teams VALUES('${uid(1)}'),('${uid(2)}');
INSERT INTO team_members VALUES('${uid(10)}','${uid(1)}','active','admin'),('${uid(11)}','${uid(1)}','active','member'),('${uid(12)}','${uid(1)}','active','member'),('${uid(20)}','${uid(2)}','active','admin');
INSERT INTO projects VALUES('${uid(100)}','${uid(1)}','${uid(10)}','active'),('${uid(200)}','${uid(2)}','${uid(20)}','active');
INSERT INTO project_members VALUES('${uid(100)}','${uid(11)}','${uid(1)}');
INSERT INTO project_objectives VALUES('${uid(101)}','${uid(100)}','${uid(1)}'),('${uid(201)}','${uid(200)}','${uid(2)}');`)
await db.exec(await readFile(new URL('../supabase/migrations/20261014120000_project_toolboards.sql', import.meta.url),'utf8'))
async function actor(n,role='authenticated'){await db.exec(`RESET ROLE; SET request.actor='${uid(n)}'; SET ROLE ${role};`)}
const board={version:1,tools:[
{id:'m',type:'measurements',title:'Sizes',wide:false,entries:[{id:'entry',name:'Bench',width:'30',depth:'',height:'20',unit:'in',notes:''}]},
{id:'s',type:'shopping',title:'Shopping',wide:false,items:[{id:'item',name:'Bench',done:false,measurementId:'entry'}]},
{id:'t',type:'tasks',title:'Tasks',wide:false,objectiveId:uid(101)},
{id:'n',type:'note',title:'Note',wide:false,text:'Hello'},
{id:'d',type:'sketch',title:'Sketch',wide:true,text:'Caption',strokes:[{width:4,points:[[1,2],[20,30]]}]}]}
const save=(rev=0,content=board,project=uid(100))=>db.query('SELECT * FROM save_project_toolboard($1,$2,$3)',[project,rev,content])
await actor(11)
assert.equal((await save()).rows[0].revision,1)
assert.equal((await save(1)).rows[0].revision,2)
await assert.rejects(()=>save(1),/Workspace changed/)
await assert.rejects(()=>save(2,{version:1,tools:[{...board.tools[2],objectiveId:uid(201)}]}),/belong to this project/)
await assert.rejects(()=>save(2,{version:1,tools:[board.tools[1]]}),/Measurements must belong/)
await assert.rejects(()=>save(2,{version:1,tools:[{...board.tools[4],strokes:[{width:4,points:[[1001,0]]}]}]}),/out of bounds/)
await assert.rejects(()=>save(2,{version:1,tools:[board.tools[3],board.tools[3]]}),/Invalid tool/)
await assert.rejects(()=>save(2,{version:1,tools:[{...board.tools[0],entries:[{...board.tools[0].entries[0],width:'NaN'}]}]}),/Invalid dimension/)
await assert.rejects(()=>db.query('UPDATE project_toolboards SET revision=9'),/permission denied/)
await actor(12);assert.equal((await db.query('SELECT * FROM project_toolboards')).rows.length,1)
await assert.rejects(()=>save(2),/Only project members/)
await actor(99);assert.equal((await db.query('SELECT * FROM project_toolboards')).rows.length,0)
await assert.rejects(()=>save(2),/Only project members/)
await actor(20);assert.equal((await db.query('SELECT * FROM project_toolboards')).rows.length,0)
await assert.rejects(()=>save(2),/Only project members/)
await db.exec(`RESET ROLE; UPDATE team_members SET status='inactive' WHERE id='${uid(11)}';`)
await actor(11);assert.equal((await db.query('SELECT * FROM project_toolboards')).rows.length,0)
await assert.rejects(()=>save(2),/Only project members/)
await db.exec(`RESET ROLE; UPDATE team_members SET status='active' WHERE id='${uid(11)}';`)
await actor(10);assert.equal((await save(2)).rows[0].revision,3)
await actor(10,'anon');await assert.rejects(()=>save(3),/permission denied/)
await db.exec(`RESET ROLE; UPDATE projects SET status='archived' WHERE id='${uid(100)}';`)
await actor(11);await assert.rejects(()=>save(3),/Only project members/)
await db.exec(`RESET ROLE; DELETE FROM projects WHERE id='${uid(100)}';`)
assert.equal((await db.query('SELECT * FROM project_toolboards')).rows.length,0)
console.log('PASS: migration, five tool types, revision conflicts, cross-project references, bounds, RLS, member/admin writes, outsider/anonymous denial, archive guard, cascade cleanup')
await db.close()

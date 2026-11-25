import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sampleProjectToolRpc} from './projectToolsSample.ts'
import {sampleTables} from './fixtures.ts'

test('project tools sample saves only synthetic projects and detects stale revisions',()=>{
  sampleTables.project_toolboards=[]
  const args={p_project_id:'sample-project-0',p_revision:0,p_content:{version:1,tools:[]}}
  assert.equal(sampleProjectToolRpc('save_project_toolboard',{...args,p_project_id:'real-project'})?.status,403)
  assert.equal(sampleProjectToolRpc('save_project_toolboard',args)?.status,200)
  assert.equal(sampleTables.project_toolboards.length,1)
  assert.equal(sampleProjectToolRpc('save_project_toolboard',args)?.status,409)
  assert.equal(sampleProjectToolRpc('save_project_toolboard',{...args,p_revision:1})?.status,200)
  assert.equal(sampleProjectToolRpc('save_project_toolboard',{...args,p_revision:2,p_content:{version:99,tools:[]}})?.status,400)
})

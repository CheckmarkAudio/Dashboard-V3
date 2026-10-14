import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTool, emptyBoard, validateBoard, moveTool, removeTool, convertMeasurement, type ToolBoard, type Measurement } from './model.ts'

test('all catalog tools start valid, have stable unique ids, and reorder without changing content', () => {
  const tools = (['measurements','shopping','tasks','note','sketch'] as const).map(createTool)
  const board: ToolBoard = { version:1, tools }
  validateBoard(board)
  assert.equal(new Set(tools.map(t=>t.id)).size,5)
  const moved=moveTool(board,tools[0]!.id,4)
  assert.deepEqual(moved.tools[4],tools[0])
  assert.deepEqual(board.tools,tools)
  assert.equal(moveTool(board,'missing',0),board)
})
test('removing measurements clears shopping links but preserves shopping and task content', () => {
  const measurement=createTool('measurements'),shopping=createTool('shopping'),task=createTool('tasks')
  assert.equal(measurement.type,'measurements');assert.equal(shopping.type,'shopping')
  if(measurement.type!=='measurements'||shopping.type!=='shopping')return
  measurement.entries=[{id:'m',name:'Closet',width:'30',depth:'',height:'',unit:'in',notes:''}]
  shopping.items=[{id:'s',name:'Shelf',done:false,measurementId:'m'}]
  const result=removeTool({version:1,tools:[measurement,shopping,task]},measurement.id)
  validateBoard(result)
  assert.equal(result.tools.length,2)
  assert.equal(result.tools[0]?.type==='shopping'&&result.tools[0].items[0]?.measurementId,null)
  assert.deepEqual(result.tools[1],task)
})
test('unit conversion keeps physical dimensions and unknown values', () => {
  const original:Measurement={id:'x',name:'Bench',width:'30',depth:'14',height:'',unit:'in',notes:''}
  const cm=convertMeasurement(original,'cm')
  assert.equal(cm.width,'76.2');assert.equal(cm.depth,'35.56');assert.equal(cm.height,'')
  assert.equal(convertMeasurement(cm,'in').width,'30')
})
test('invalid data, dangling links, duplicate identities and excessive drawing sizes are rejected', () => {
  assert.throws(()=>validateBoard({version:2,tools:[]}))
  assert.throws(()=>validateBoard({version:1,tools:Array.from({length:41},()=>createTool('note'))}))
  const note=createTool('note');assert.throws(()=>validateBoard({version:1,tools:[note,note]}))
  const shopping=createTool('shopping');if(shopping.type==='shopping')shopping.items=[{id:'s',name:'x',done:false,measurementId:'outside'}]
  assert.throws(()=>validateBoard({version:1,tools:[shopping]}))
  const sketch=createTool('sketch');if(sketch.type==='sketch')sketch.strokes=[{width:4,points:[[1001,1]]}]
  assert.throws(()=>validateBoard({version:1,tools:[sketch]}))
  validateBoard(emptyBoard())
})

import path from 'path'
import assert from 'assert'
import Knex from 'knex'
import { createModels } from '..'
import app from '../../project/app.json'
const relativeTo = path.join(__dirname, '../../project')

const knex = Knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'Babble01',
    database: 'stoneware'
  }
})

function isIsoDate (str) {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return false
  var d = new Date(str)
  return d.toISOString() === str
}

function isYYYYMMDD (str) {
  return /\d{4}-\d{2}-\d{2}/.test(str)
}

async function createPerson () {
  const models = await createModels(app, knex, { relativeTo })

  const payload = {
    title: 'Mrs',
    first_name: 'Jane',
    last_name: 'Doe',
    ni: Math.random().toString(36).slice(4, 12),
    latlng: {
      latitude: 45,
      longitude: 45
    },
    address: {
      city: 'Northwich',
      street: '101 Chester Road',
      zip_code: 'CW8 4AA',
      built_at: '2019-05-17T09:01:41.497Z'
    }
  }

  const jane = await models.Person
    .query()
    .insertAndFetch(payload)

  assert.strictEqual(typeof jane.dob, 'string')
  assert.strictEqual(isYYYYMMDD(jane.dob), true)

  assert.strictEqual(typeof jane.updated_at, 'string')
  assert.strictEqual(isIsoDate(jane.updated_at), true)

  assert.strictEqual(typeof jane.created_at, 'string')
  assert.strictEqual(isIsoDate(jane.created_at), true)

  const json = jane.toJSON()

  // Update ni as it's unique
  json.ni = Math.random().toString(36).slice(4, 12)

  const person2 = models.Person.fromJson(json)

  console.log(person2)

  delete person2.id

  const person3 = await models.Person
    .query()
    .insertAndFetch(person2)

  console.log(person3)
}

createPerson()

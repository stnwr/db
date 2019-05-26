import path from 'path'
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

async function createSimple () {
  const models = await createModels(app, knex, { relativeTo })

  const gotSimple1 = await models.Simple
    .query()
    .findById(1)

  console.log(gotSimple1)
}

createSimple()

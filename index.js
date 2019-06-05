import path from 'path'
import { compose, Model } from 'objection'
import parser from 'json-schema-ref-parser'
import relationsHelper from '@stoneware/common/helpers/relations'
import { getSchemaFromTable } from '@stoneware/common/helpers/schema'

import ModelMixinFactory from './ModelMixin.js'

function createModelFromTable (app, table, schemas, resolveModel, BaseModel) {
  const name = table.name
  const modelName = table.modelName
  const relationMappings = {}
  const relations = table.fields.filter(f => f.type === 'relation')

  relations.forEach(relation => {
    const targetTable = app.tables.find(t => t.name === relation.table)
    const modelName = targetTable.modelName
    relationMappings[relation.name] = {
      relation: Model[`${relation.kind}Relation`],
      modelClass: () => resolveModel(modelName),
      join: {
        to: `${relation.table}.${relation.to}`,
        from: `${table.name}.${relation.from}`
      }
    }
  })

  const schema = getSchemaFromTable(table, schemas)
  const ModelMixin = ModelMixinFactory({ table, schema, relationMappings, name })

  // todo: register userland mixins, softdelete, session mixin etc
  const mixins = compose(
    ModelMixin
    // SomeOtherMixin,
    // EvenMoreMixins,
    // LolSoManyMixins,
    // ImAMixinWithOptions({ foo: 'bar' })
  )

  return ({
    [modelName]: class extends mixins(BaseModel) {}
  })
}

function getKnexTypeArgsFromField (field) {
  const { type, enum: enumerable } = field

  switch (type) {
    case 'string':
      if (Array.isArray(enumerable)) {
        return ['enum', enumerable]
      } else {
        return field.maxLength > 255
          ? ['text', field.maxLength]
          : ['string', field.maxLength]
      }
    case 'date':
    case 'time':
    case 'datetime':
    case 'integer':
    case 'boolean':
    case 'json':
      return [type]
    case 'number':
      return ['float']
    case 'id':
      return ['integer']
    default: {
      throw new Error(`Unsupported type "${type}"`)
    }
  }
}

function createColumnFromField (db, def, table, field, knex) {
  const { type } = field
  const [dbType, ...rest] = getKnexTypeArgsFromField(field)

  let chain = table[dbType](field.name, ...rest)[field.nullable ? 'nullable' : 'notNullable']()

  if (field.default) {
    chain = chain.defaultTo(field.default === 'now'
      ? knex.fn.now()
      : field.default)
  }

  if (type === 'id') {
    chain = chain.unsigned()
  } else if (type === 'number') {

  } else if (type === 'integer') {
    if (field.minimum >= 0) {
      chain = chain.unsigned()
    }
  }

  if (field.description) {
    chain = chain.comment(field.description)
  }

  console.log(chain)
}

function createTableFactory ({ app, def }) {
  return function (knex) {
    return new Promise((resolve, reject) => {
      let tbl = null
      knex.schema
        .createTable(def.name, function (table) {
          tbl = table

          // Include default id column
          table.increments('id').unsigned().primary()

          const fieldFilter = field => field.name !== 'id' &&
            field.type !== 'relation' && field.virtual !== true

          // Add columns from properties
          def.fields
            .filter(fieldFilter)
            .forEach(field => createColumnFromField(app, def, table, field, knex))

          // Include default timestamp columns
          const now = knex.fn.now()
          table.timestamp('updatedAt').notNullable().defaultTo(now)
          table.timestamp('createdAt').notNullable().defaultTo(now)

          // Indexes
          if (Array.isArray(def.indexes)) {
            def.indexes.forEach(index => {
              table[index.unique ? 'unique' : 'index'](index.columns)
            })
          }
        })
        .then(() => resolve(tbl))
        .catch(err => reject(err))
    })
  }
}

async function addRelation (knex, def, relation) {
  return new Promise((resolve, reject) => {
    knex.schema
      .table(def.name, function (table) {
        const ref = `${relation.table}.${relation.to}`
        table.foreign(relation.from).references(ref)
      })
      .then(result => resolve(result))
      .catch(err => reject(err))
  })
}

export async function createModels (app, knex, { relativeTo, schemaPath = 'schema', modelsPath = 'models' } = {}) {
  const tables = app.tables

  const models = {}

  // Resolve any json field schema refs
  for await (const table of tables) {
    const jsonFields = table.fields.filter(f => f.type === 'json')
    const files = jsonFields.map(f => path.join(relativeTo, schemaPath, f.ref))
    const opts = { dereference: { circular: 'ignore' } }
    const promises = files.map(file => parser.dereference(file, opts))
    const schemas = (await Promise.all(promises))
      .map((schema, i) => ({ schema, field: jsonFields[i] }))

    let BaseModel = class BaseModel extends Model {}

    // todo: throw error if file not found
    // or only fail if the table has virtuals?
    if (table.modelPath) {
      const modelPath = path.join(relativeTo, modelsPath, table.modelPath)

      try {
        const CustomModel = require(modelPath)

        if (CustomModel && typeof CustomModel.default === 'function') {
          BaseModel = CustomModel.default(Model)
        }
      } catch (err) {
        console.warn(`Missing model class file ${modelPath}`)
      }
    }

    // Give the knex object to objection.
    BaseModel.knex(knex)

    const model = createModelFromTable(app, table, schemas, resolveModel, BaseModel)

    Object.assign(models, model)
  }

  function resolveModel (ref) {
    return models[ref]
  }

  return models
}

export async function createDB (app, knex) {
  try {
    const tables = app.tables
    console.log('tables', tables)

    // Process tables
    const results = {}
    for await (const def of tables) {
      const factory = createTableFactory({ app, def })

      const result = await factory(knex)
      results[def.name] = result
    }
    console.log('results', results)

    const fkTypes = relationsHelper.Types1

    for await (const def of tables) {
      const relations = def.fields
        .filter(f => f.type === 'relation')
        .filter(f => fkTypes[f.kind].foreignKey(f))

      for (const relation of relations) {
        await addRelation(knex, def, relation)
      }
    }
  } catch (err) {
    console.error(err)
    throw err
  }
}

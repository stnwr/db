import path from 'path'
import dayjs from 'dayjs'
import assert from 'assert'
import { Model, snakeCaseMappers } from 'objection'
import parser from 'json-schema-ref-parser'
import relationsHelper from '@stoneware/common/helpers/relations'

function resolveJoin (join, resolveModel) {
  const result = {
    to: `${join.to.table}.${join.to.column}`,
    from: `${join.from.table}.${join.from.column}`
  }

  if (join.through) {
    result.through = {
      to: `${join.through.to.table}.${join.through.to.column}`,
      from: `${join.through.from.table}.${join.through.from.column}`,
      extra: join.through.extra,
      modelClass: resolveModel(join.through.modelClass)
    }
  }

  return result
}

function createModelFromSchema (schema, table, relations, resolveModel, BaseModel) {
  const name = table.name
  const modelName = table.modelName
  const relationMappings = {}

  const modelRelations = relations
    .filter(relation => relation.join.from.table === name)

  modelRelations.forEach(relation => {
    const { join, modelClass, name, onDelete } = relation

    relationMappings[name] = {
      relation: Model[`${relation.type}Relation`],
      modelClass: () => resolveModel(modelClass),
      join: resolveJoin(join, resolveModel)
    }
  })

  const timestamp = {
    type: 'string',
    format: 'date-time'
  }

  Object.assign(schema.properties, {
    updated_at: timestamp,
    created_at: timestamp
  })

  return ({
    [modelName]: class extends BaseModel {
      static get tableName () {
        return name
      }

      // static get columnNameMappers () {
      //   return snakeCaseMappers()
      // }

      static get pickJsonSchemaProperties () {
        return true
      }

      static get idColumn () {
        return 'id'
      }

      static get jsonSchema () {
        return schema
      }

      static get relationMappings () {
        return relationMappings
      }

      // database -> $parseDatabaseJson -> internal
      // internal -> $formatDatabaseJson -> database
      // external -> $parseJson -> internal
      // internal -> $formatJson -> external

      // $beforeUpdate
      // $afterUpdate
      // $beforeInsert
      // $afterInsert
      // $beforeDelete
      // $afterDelete
      // $afterGet

      $omitFromDatabaseJson () {
        return ['created_at']
      }

      $beforeUpdate () {
        this.updated_at = new Date().toISOString()
      }

      $parseDatabaseJson (json) {
        json = super.$parseDatabaseJson(json)

        Object.keys(schema.properties).forEach(key => {
          const prop = schema.properties[key]
          const value = json[key]

          // Turn dates coming out of the db into strings
          if (value instanceof Date) {
            if (prop.format === 'date') {
              json[key] = dayjs(json[key]).format('YYYY-MM-DD')
            } else if (prop.format === 'date-time') {
              json[key] = value.toISOString()
            }
          }
        })

        return json
      }

      $formatDatabaseJson (json, opt) {
        // This ensures that any date values (strings or Date)
        // are properly formatted prior to insert/update into the db.
        // MySQL doesn't accept dates with millisecond (.sssZ)
        Object.keys(schema.properties).forEach(key => {
          const prop = schema.properties[key]
          if (json[key]) {
            if (prop.format === 'date') {
              json[key] = dayjs(json[key]).format('YYYY-MM-DD')
            } else if (prop.format === 'date-time') {
              json[key] = dayjs(json[key]).format('YYYY-MM-DD HH:mm:ss')
            }
          }
        })

        return super.$formatDatabaseJson(json, opt)
      }
    }
  })
}

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

  return ({
    [modelName]: class extends BaseModel {
      static get tableName () {
        return name
      }

      // static get columnNameMappers () {
      //   return snakeCaseMappers()
      // }

      static get pickJsonSchemaProperties () {
        return true
      }

      static get idColumn () {
        return 'id'
      }

      static get jsonSchema () {
        return schema
      }

      static get relationMappings () {
        return relationMappings
      }

      // database -> $parseDatabaseJson -> internal
      // internal -> $formatDatabaseJson -> database
      // external -> $parseJson -> internal
      // internal -> $formatJson -> external

      // $beforeUpdate
      // $afterUpdate
      // $beforeInsert
      // $afterInsert
      // $beforeDelete
      // $afterDelete
      // $afterGet

      $omitFromDatabaseJson () {
        return ['created_at']
      }

      $beforeUpdate () {
        this.updated_at = new Date().toISOString()
      }

      $parseDatabaseJson (json) {
        json = super.$parseDatabaseJson(json)

        Object.keys(schema.properties).forEach(key => {
          const prop = schema.properties[key]
          const value = json[key]

          // Turn dates coming out of the db into strings
          if (value instanceof Date) {
            if (prop.format === 'date') {
              json[key] = dayjs(json[key]).format('YYYY-MM-DD')
            } else if (prop.format === 'date-time') {
              json[key] = value.toISOString()
            }
          }
        })

        return json
      }

      $formatDatabaseJson (json, opt) {
        // This ensures that any date values (strings or Date)
        // are properly formatted prior to insert/update into the db.
        // MySQL doesn't accept dates with millisecond (.sssZ)
        Object.keys(schema.properties).forEach(key => {
          const prop = schema.properties[key]
          if (json[key]) {
            if (prop.format === 'date') {
              json[key] = dayjs(json[key]).format('YYYY-MM-DD')
            } else if (prop.format === 'date-time') {
              json[key] = dayjs(json[key]).format('YYYY-MM-DD HH:mm:ss')
            }
          }
        })

        return super.$formatDatabaseJson(json, opt)
      }
    }
  })
}

function getSchemaFromTable (table, schemas) {
  const schema = {
    required: [],
    properties: {},
    additionalProperties: false // <= relations?
  }

  const timestamp = {
    type: 'string',
    format: 'date-time'
  }

  table.fields.forEach(field => {
    if (field.type !== 'relation') {
      if (field.type === 'json') {
        schema.properties[field.name] = schemas.find(s => s.field === field).schema
      } else {
        schema.properties[field.name] = getSchemaFromField(field)
      }

      if (!field.nullable && field.name !== 'id') {
        schema.required.push(field.name)
      }
    }
  })

  Object.assign(schema.properties, {
    updated_at: timestamp,
    created_at: timestamp
  })

  return schema
}

function getSchemaFromField (field) {
  const schema = {}
  const ignore = ['nullable']

  for (let key in field) {
    if (ignore.indexOf(key) < 0) {
      let value = field[key]
      if (key === 'type') {
        if (value === 'id') {
          value = 'integer'
          schema.minimum = 1
        } else if (value === 'date') {
          value = 'string'
          schema.format = 'date'
        } else if (value === 'time') {
          value = 'string'
          schema.format = 'time'
        } else if (value === 'datetime') {
          value = 'string'
          schema.format = 'date-time'
        }
      }

      if (key !== 'name') {
        schema[key] = key === 'type' && field.nullable
          ? [value, 'null']
          : value
      }
    }
  }

  return schema
}

function getKnexTypeArgsFromProperty (property) {
  const { type, format, enum: enumerable, _db = {} } = property

  const timeFormatters = ['date-time', 'date', 'time']

  switch (type) {
    case 'string':
      if (timeFormatters.includes(format)) {
        return [format.replace('-', '')]
      } else if (Array.isArray(enumerable)) {
        return ['enum', enumerable]
      } else {
        return _db['text'] || property.maxLength > 255
          ? ['text', property.maxLength]
          : ['string', property.maxLength]
      }
    case 'integer':
    case 'boolean':
      return [type]
    case 'number': {
      return ['float']
    }
    case 'object':
    case 'array': {
      return ['json']
    }
    default: {
      throw new Error(`Unsupported type "${type}"`)
    }
  }
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

function createColumnFromProperty (db, def, table, key, schema, knex) {
  const { properties, required = [] } = schema
  let property = properties[key]
  let nullable = !required.includes(key)

  if (Array.isArray(property.type)) {
    const types = property.type
    assert.strictEqual(types.length, 2)
    const notNullTypes = types.filter(type => type !== 'null')
    assert.strictEqual(notNullTypes.length, 1)
    property.type = notNullTypes[0]
    nullable = true
  }

  const { type } = property
  const [dbType, ...rest] = getKnexTypeArgsFromProperty(property)

  let chain = table[dbType](key, ...rest)[nullable ? 'nullable' : 'notNullable']()

  if (property.default) {
    chain = chain.defaultTo(property.default === 'now'
      ? knex.fn.now()
      : property.default)
  }

  if (type === 'string') {

  } else if (type === 'number') {

  } else if (type === 'integer') {
    if (property.minimum >= 0) {
      chain = chain.unsigned()
    }
  }

  if (property.description) {
    chain = chain.comment(property.description)
  }

  const relations = relationsHelper.getRelationsFromColumn(db, def, key)

  if (relations.length) {
    // assert.strictEqual(relations.length, 1)
    // const relation = relations[0]

    // // if (relation.type !== 'ManyToMany') {
    // const join = relation.join

    // chain
    //   .unsigned()
    //   .references(join.to.column)
    //   .inTable(join.to.table)
    //   .onDelete(relation.onDelete)
    // } else {
    //   const join = relation.join

    //   chain
    //     .unsigned()
    //     .references(join.from.column)
    //     .inTable(join.from.table)
    //     .onDelete(relation.onDelete)
    // }
  }

  console.log(chain)
}

function createTableFactory ({ app, def, schema }) {
  return function (knex) {
    return new Promise((resolve, reject) => {
      const { properties } = schema
      let tbl = null
      knex.schema
        .createTable(def.name, function (table) {
          tbl = table

          // Include default id column
          table.increments('id').unsigned().primary()

          // Add columns from properties
          Object.keys(properties)
            .filter(key => key !== 'id')
            .forEach(key => createColumnFromProperty(app, def, table, key, schema, knex))

          // Include default timestamp
          // columns (created_at, updated_at)
          table.timestamps(true, true)

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

function createTableFactory1 ({ app, def }) {
  return function (knex) {
    return new Promise((resolve, reject) => {
      let tbl = null
      knex.schema
        .createTable(def.name, function (table) {
          tbl = table

          // Include default id column
          table.increments('id').unsigned().primary()

          // Add columns from properties
          def.fields
            .filter(field => field.name !== 'id' && field.type !== 'relation')
            .forEach(field => createColumnFromField(app, def, table, field, knex))

          // Include default timestamp
          // columns (created_at, updated_at)
          table.timestamps(true, true)

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

export async function createModels (db, knex, { relativeTo, schemaPath = 'schema/db' } = {}) {
  const tables = db.tables
  const files = tables.map(table => path.join(relativeTo, schemaPath, table.schema))
  const opts = { dereference: { circular: 'ignore' } }
  const promises = files.map(file => parser.dereference(file, opts))
  const schemas = await Promise.all(promises)

  class BaseModel extends Model {}

  // Give the knex object to objection.
  BaseModel.knex(knex)

  // Read the entity relations
  const relations = db.relations

  const models = {}
  function resolveModel (ref) {
    return models[ref]
  }

  // Build the Objection ORM models from the schema/relations
  const schemaModels = schemas.map((schema, idx) =>
    createModelFromSchema(schema,
      tables[idx],
      relations,
      resolveModel,
      BaseModel
    ))

  Object.assign(models, ...schemaModels)

  return models
}

export async function createModels1 (app, knex, { relativeTo, schemaPath = 'schema' } = {}) {
  const tables = app.tables

  class BaseModel extends Model {}

  // Give the knex object to objection.
  BaseModel.knex(knex)

  const models = {}

  // Resolve any json field schema refs
  for await (const table of tables) {
    const jsonFields = table.fields.filter(f => f.type === 'json')
    const files = jsonFields.map(f => path.join(relativeTo, schemaPath, f.ref))
    const opts = { dereference: { circular: 'ignore' } }
    const promises = files.map(file => parser.dereference(file, opts))
    const schemas = (await Promise.all(promises))
      .map((schema, i) => ({ schema, field: jsonFields[i] }))

    const model = createModelFromTable(app, table, schemas, resolveModel, BaseModel)

    Object.assign(models, model)
  }

  function resolveModel (ref) {
    return models[ref]
  }

  return models
}

export async function createDB (app, knex, { relativeTo, schemaPath = 'schema/db' } = {}) {
  try {
    // const sorter = factorySorter(db)
    const tables = app.tables // sort(app) // .sort(sorter)
    const files = tables.map(table => path.join(relativeTo, schemaPath, table.schema))
    const opts = { dereference: { circular: 'ignore' } }
    const promises = files.map(file => parser.dereference(file, opts))
    const schemas = await Promise.all(promises)
    console.log('schemas', schemas)

    // Process schema
    let idx = 0
    const results = {}
    for await (const schema of schemas) {
      const def = tables[idx]
      const factory = createTableFactory({ app, def, schema })

      const result = await factory(knex)

      // const result = await factory(knex)
      // console.log(def.name, result)
      results[def.name] = result
      idx++
    }

    const relations = app.relations
    const fkTypes = relationsHelper.Types
    const fkRelations = relations.filter(relation => fkTypes[relation.type].foreignKey(relation))

    for (const relation of fkRelations) {
      await addRelation(knex, relation)
    }
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function addRelation (knex, relation) {
  return new Promise((resolve, reject) => {
    knex.schema
      .table(relation.join.from.table, function (table) {
        const ref = `${relation.join.to.table}.${relation.join.to.column}`
        table.foreign(relation.join.from.column).references(ref)
      })
      .then(result => resolve(result))
      .catch(err => reject(err))
  })
}

export async function createDB1 (app, knex) {
  try {
    const tables = app.tables
    console.log('tables', tables)

    // Process tables
    const results = {}
    for await (const def of tables) {
      const factory = createTableFactory1({ app, def })

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
        await addRelation1(knex, def, relation)
      }
    }
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function addRelation1 (knex, def, relation) {
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

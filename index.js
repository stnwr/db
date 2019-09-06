import path from 'path'
import { compose, Model } from 'objection'
import parser from 'json-schema-ref-parser'
import { getSchemaFromTable } from '@stoneware/common/helpers/schema'
import { allowDefault, allowIndex, allowNullable, allowPrimary, allowUnique } from '@stoneware/common/helpers/types'
import ModelMixinFactory from './ModelMixin.js'

function preprocessField (app, field) {
  if (field.type !== 'fk') {
    return Object.assign({}, field)
  } else {
    // Foreign key fields lend properties from their target field
    const foreignTable = app.tables.find(t => t.name === field.table)
    const foreignField = foreignTable.fields.find(f => f.name === field.to)
    const { name, title, description, index, unique, primary } = field
    const { type, minimum, maximum, minLength, maxLength, unsigned, auto } = foreignField

    return Object.assign({},
      { type, minimum, maximum, minLength, maxLength, unsigned: auto || unsigned },
      { name, title, description, index, unique, primary })
  }
}

function createColumn (app, def, table, field, knex) {
  field = preprocessField(app, field)

  const { type, name, title, description } = field
  let { default: defaultValue } = field
  let col

  if (type === 'string') {
    const { enum: enumerable } = field

    if (Array.isArray(enumerable)) {
      col = table.enum(name, enumerable)
    } else {
      col = field.maxLength > 255
        ? table.text(name, field.maxLength)
        : table.string(name, field.maxLength)
    }
  } else if (type === 'number') {
    col = table.float(name)
  } else if (type === 'integer') {
    if (field.auto) {
      col = table.increments(name)
    } else {
      col = table.integer(name)

      if (field.unsigned || field.minimum >= 0) {
        col = col.unsigned()
      }
    }
  } else if (type === 'date' || type === 'datetime') {
    col = table[type](name)

    if (defaultValue === 'now') {
      defaultValue = knex.fn.now()
    }
  } else if (type === 'boolean' || type === 'time' || type === 'json') {
    col = table[type](name)
  } else {
    throw new Error(`Unsupported type "${type}"`)
  }

  // Column comment
  if (description || title) {
    col = col.comment(description || title)
  }

  // Primary key
  if (field.primary && allowPrimary.includes(type)) {
    const primaryFieldsCount = def.fields.filter(col => col.primary).length
    const hasSinglePrimaryField = primaryFieldsCount === 1

    if (hasSinglePrimaryField) {
      col = col.primary()
    }
  }

  // Default value
  if (defaultValue && allowDefault.includes(type)) {
    col = col.defaultTo(defaultValue)
  }

  // Nullable
  if (field.nullable && allowNullable.includes(type)) {
    col = col.nullable()
  } else {
    col = col.notNullable()
  }

  // Column index
  if (field.index && allowIndex.includes(type)) {
    col = col.index()
  }

  // Column unique
  if (field.unique && allowUnique.includes(type)) {
    col = col.unique()
  }

  return col
}

function createTableFactory ({ app, def }) {
  return function (knex) {
    return new Promise((resolve, reject) => {
      let tbl = null
      knex.schema
        .createTable(def.name, function (table) {
          tbl = table

          const filter = f => f.virtual !== true && f.type !== 'relation'

          // Add fields
          def.fields
            .filter(filter)
            .forEach(field => createColumn(app, def, table, field, knex))

          // Check for composite primary keys
          const primaryField = def.fields
            .filter(filter)
            .filter(col => col.primary)

          if (primaryField.length > 1) {
            table.primary(primaryField.map(f => f.name))
          }

          // Include default timestamp columns
          if (!def.excludeDefaultFields) {
            const now = knex.fn.now()

            table.timestamp('updatedAt').notNullable()
              .defaultTo(now).comment('Updated timestamp')

            table.timestamp('createdAt').notNullable()
              .defaultTo(now).comment('Created timestamp')
          }
        })
        .then(() => resolve(tbl))
        .catch(err => reject(err))
    })
  }
}

async function addForeignKeys (knex, def) {
  return new Promise((resolve, reject) => {
    knex.schema
      .table(def.name, table => {
        function addForeignKey (from, tableName, to, cascadeOnDelete) {
          let chain = table.foreign(from)
            .references(to).inTable(tableName)

          if (cascadeOnDelete) {
            chain = chain.onDelete('CASCADE')
          }

          return chain
        }

        for (const field of def.fields.filter(f => f.type === 'fk')) {
          addForeignKey(field.name, field.table, field.to, field.cascadeOnDelete)
        }

        if (Array.isArray(def.foreignKeys)) {
          for (const key of def.foreignKeys) {
            addForeignKey(key.from, key.table, key.to, key.cascadeOnDelete)
          }
        }
      })
      .then(result => resolve(result))
      .catch(err => reject(err))
  })
}

async function addIndexes (knex, def) {
  return new Promise((resolve, reject) => {
    knex.schema
      .table(def.name, table => {
        return def.indexes.map(index => {
          return table[index.unique ? 'unique' : 'index'](index.fields)
        })
      })
      .then(result => resolve(result))
      .catch(err => reject(err))
  })
}

function createModel (app, table, schemas, resolveModel, BaseModel) {
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
    [modelName]: class extends mixins(BaseModel) { }
  })
}

export async function createModels (app, knex, { relativeTo, schemaPath = 'schema', modelsPath = 'models' } = {}) {
  const tables = app.tables

  const models = {}

  // Resolve any json field schema refs
  for await (const table of tables) {
    const jsonFields = table.fields.filter(f => f.type === 'json')
    const jsonFieldsWithRef = jsonFields.filter(f => f.ref)
    const files = jsonFieldsWithRef
      .map(f => path.join(relativeTo, schemaPath, f.ref))
    const opts = { dereference: { circular: 'ignore' } }
    const promises = files.map(file => parser.dereference(file, opts))
    const schemas = (await Promise.all(promises))
      .map((schema, i) => ({ schema, field: jsonFieldsWithRef[i] }))

    let BaseModel = class BaseModel extends Model { }

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

    const model = createModel(app, table, schemas, resolveModel, BaseModel)

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

    // Foreign keys
    for await (const table of tables) {
      if (table.fields.filter(f => f.type === 'fk') ||
        (Array.isArray(table.foreignKeys) && table.foreignKeys.length)) {
        await addForeignKeys(knex, table)
      }

      // Indexes
      if (Array.isArray(table.indexes) && table.indexes.length) {
        await addIndexes(knex, table)
      }
    }
  } catch (err) {
    console.error(err)
    throw err
  }
}

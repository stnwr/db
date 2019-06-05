import dayjs from 'dayjs'
// import expreval from 'expr-eval'

export default ({ table, schema, relationMappings, name }) => {
  const virtualAttributes = table.fields
    .filter(f => f.virtual)
    .map(f => f.name)

  return function ModelMixin (Model) {
    return class extends Model {
      static get tableName () {
        return name
      }

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

      static get virtualAttributes () {
        return virtualAttributes
      }

      // get idStr () {
      //   return this.id.toString()
      // }

      // get expr () {
      //   var expr = expreval.Parser.parse('2 * id + 1')
      //   return expr.evaluate(this)
      // }

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
        return ['createdAt']
      }

      $beforeUpdate () {
        this.updatedAt = new Date().toISOString()
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
  }
}

export function tableRelations (app, table) {
  const fkTypes = ['HasOne', 'BelongsToOne', 'ManyToMany']

  return app.relations
    .filter(relation =>
      fkTypes.includes(relation.type) &&
      tableRelationTarget(relation).from.table === table.name)
}

export function tableRelationTarget (relation) {
  return relation.type === 'ManyToMany'
    ? relation.join.through
    : relation.join
}

export function columnRelations (app, table, columnName) {
  return tableRelations(app, table)
    .filter(relation => tableRelationTarget(relation).from.column === columnName)
}



// function factorySorter (db) {
//   return function sorter (a, b) {
//     const aRefs = tableRelations(db, a)
//       .map(relation => relation.join.to.table)

//     const bRefs = tableRelations(db, b)
//       .map(relation => relation.join.to.table)

//     const aRefsB = aRefs.includes(b.name)
//     const bRefsA = bRefs.includes(a.name)

//     console.log(a.name, b.name)
//     // const aRefsBsRefs = aRefs.some(tbl => bRefs.includes(tbl))
//     // const bRefsAsRefs = bRefs.some(tbl => aRefs.includes(tbl))

//     if (aRefsB && bRefsA) {
//       throw new Error('TODO: Deal with circular refs')
//     } else if (aRefsB || aRefsB.length < bRefs.length) {
//       return 1
//     } else if (bRefsA || bRefs.length < aRefsB.length) {
//       return -1
//     }

//     return 0
//   }
// }

// function sort (app) {
//   const output = []
//   const tables = app.tables.slice() // .map(table => table.name)

//   return tables.sort((a, b) => {
//     const aDeps = relationsHelper.getTableDependencies(app, a)
//     const bDeps = relationsHelper.getTableDependencies(app, b)

//     if (aDeps.length > bDeps.length) {
//       return 1
//     } else if (aDeps.length > bDeps.length) {
//       return -1
//     } else {
//       return 0
//     }
//   })
//   // while (tables.length) {
//   //   for (let i in tables) {
//   //     let table = tables[i]

//   //     let dependencies = relationsHelper.getTableDependencies(app, table)
//   //       // .filter(relation => relation.type === 'BelongsToOne' || relation.type === 'HasOne')
//   //       .map(relation => relation.join.to.table)

//   //     if (dependencies.every(dependency => output.includes(dependency))) {
//   //       // If all dependencies are already in the output array
//   //       output.push(table.name) // Pushing "A" to the output
//   //       tables.splice(i, 1) // Removing "A" from the keys
//   //     }
//   //   }
//   // }

//   // return output.map(name => app.tables.find(table => table.name === name))
// }





      // $beforeInsert () {
      //   const date = new Date().toISOString()

      //   this.updatedAt = date
      //   this.createdAt = date
      // }

      // $formatJson (json) {
      //   json = super.$formatJson(json)

      //   Object.keys(schema.properties).forEach(key => {
      //     const prop = schema.properties[key]
      //     if (json[key] instanceof Date) {
      //       if (prop.format === 'date') {
      //         json[key] = dayjs(json[key]).format('YYYY-MM-DD')
      //       } else if (prop.format === 'date-time') {
      //         json[key] = json[key].toJSON()
      //       }
      //     }
      //   })

      //   return json
      // }

      // $parseJson (json, opt) {
      //   // delete json.createdAt
      //   // delete json.updatedAt
      //   json = super.$parseJson(json, opt)

      //   Object.keys(schema.properties).forEach(key => {
      //     const prop = schema.properties[key]
      //     if (typeof json[key] === 'string') {
      //       if (prop.format === 'date') {
      //         json[key] = dayjs(json[key]).toDate()
      //       } else if (prop.format === 'date-time') {
      //         json[key] = dayjs(json[key]).toDate()
      //       }
      //     }
      //   })

      //   return json
      // }















// async function createMovies (models) {
//   // ,
//   // {
//   //   "name": "critic",
//   //   "modelName": "Critic",
//   //   "displayName": "Critic",
//   //   "schema": "critic.json"
//   // },
//   // {
//   //   "name": "movie",
//   //   "modelName": "Movie",
//   //   "displayName": "Movie",
//   //   "schema": "movie.json"
//   // },
//   // {
//   //   "name": "review",
//   //   "modelName": "Review",
//   //   "displayName": "Review",
//   //   "schema": "review.json"
//   // }
//   // ,
//   // {
//   //   "name": "reviews",
//   //   "type": "ManyToMany",
//   //   "modelClass": "Movie",
//   //   "join": {
//   //     "from": {
//   //       "table": "critic",
//   //       "column": "id"
//   //     },
//   //     "to": {
//   //       "table": "movie",
//   //       "column": "id"
//   //     },
//   //     "through": {
//   //       "from": {
//   //         "table": "review",
//   //         "column": "criticId"
//   //       },
//   //       "to": {
//   //         "table": "review",
//   //         "column": "movieId"
//   //       },
//   //       "extra": ["rating", "body"],
//   //       "modelClass": "Review"
//   //     }
//   //   },
//   //   "onDelete": "CASCADE"
//   // },
//   // {
//   //   "name": "reviews",
//   //   "type": "ManyToMany",
//   //   "modelClass": "Critic",
//   //   "join": {
//   //     "from": {
//   //       "table": "movie",
//   //       "column": "id"
//   //     },
//   //     "to": {
//   //       "table": "critic",
//   //       "column": "id"
//   //     },
//   //     "through": {
//   //       "from": {
//   //         "table": "review",
//   //         "column": "movieId"
//   //       },
//   //       "to": {
//   //         "table": "review",
//   //         "column": "criticId"
//   //       },
//   //       "extra": ["rating", "body"],
//   //       "modelClass": "Review"
//   //     }
//   //   },
//   //   "onDelete": "CASCADE"
//   // }
//   const critic1 = await assertInsert({
//     title: 'Mr',
//     firstName: 'Jon',
//     lastName: 'Doe'
//   }, models.Critic)

//   const critic2 = await assertInsert({
//     title: 'Mr',
//     firstName: 'Barry',
//     lastName: 'Norman'
//   }, models.Critic)

//   const movie1 = await assertInsert({
//     name: 'Toy Story',
//     synopsis: 'Toy adventure',
//     year: 1994
//   }, models.Movie)

//   const movie2 = await assertInsert({
//     name: 'Back to the future',
//     synopsis: 'Time travel adventure',
//     year: 1985
//   }, models.Movie)

//   const review1 = await assertInsert({
//     criticId: critic1.id,
//     movieId: movie1.id,
//     body: 'Excellent!!',
//     rating: 5
//   }, models.Review)

//   const review2 = await assertInsert({
//     criticId: critic1.id,
//     movieId: movie2.id,
//     body: 'Great fun!',
//     rating: 4
//   }, models.Review)

//   const review3 = await assertInsert({
//     criticId: critic2.id,
//     movieId: movie1.id,
//     body: 'Fab!',
//     rating: 5
//   }, models.Review)

//   const gotCritic1 = await models.Critic
//     .query()
//     .eager('reviews')
//     .findById(critic1.id)

//   const gotCritic2 = await models.Critic
//     .query()
//     .eager('reviews')
//     .findById(critic2.id)

//   const gotMovie1 = await models.Movie
//     .query()
//     .eager('reviews')
//     .findById(movie1.id)

//   const gotMovie2 = await models.Movie
//     .query()
//     .eager('reviews')
//     .findById(movie2.id)

//   console.log(critic1, critic2, movie1, movie2, review1, review2, review3, gotCritic1, gotCritic2, gotMovie1, gotMovie2)
// }
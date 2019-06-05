import path from 'path'
import assert from 'assert'
import Knex from 'knex'
import app from '../../project/app.json'
import { createDB, createModels } from '..'
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

// async function testCreateDB () {
//   createDB(app, knex, { relativeTo })
// }

async function testCreateModels () {
  const models = await createModels(app, knex, { relativeTo })
  console.log(models)
  createSimple(models)
  createOrders(models)
  createPersonPetsData(models)
  // createStudents(models)
}

async function assertInsert (data, Model) {
  const model = await Model
    .query()
    .insert(data)

  assert.ok(model instanceof Model)

  return model
}

async function createSimple (models) {
  const ex1 = await models.Simple
    .query()
    .insert({
      name: 'foo',
      description: 'bar',
      content: Math.random().toString(36).slice(2),
      // timestamp: '2019-04-08 22:00:57',
      age: 45,
      flag: true,
      price: 4.95,
      agreeTerms: true,
      email: 'a@b.com',
      purchasedAt: new Date().toISOString()
    })

  console.log(ex1)
}

async function createOrders (models) {
  const customer = await assertInsert({
    title: 'Mr',
    firstName: 'Jon',
    lastName: 'Doe',
    ni: Math.random().toString(36).substring(2, 10),
    address: {
      city: 'New York',
      street: '5th Avenue',
      zipCode: 'NY123'
    }
  }, models.Customer)

  const basket = await assertInsert({
    customerId: customer.id
  }, models.Basket)

  const bread = await assertInsert({
    code: 'P001',
    name: 'Bread',
    description: 'Loafy',
    price: 0.99
  }, models.Product)

  const milk = await assertInsert({
    code: 'P002',
    name: 'Milk',
    description: 'Milky',
    price: 1.50
  }, models.Product)

  const line1 = await assertInsert({
    basketId: basket.id,
    productId: milk.id,
    quantity: 2
  }, models.BasketLine)

  const line2 = await assertInsert({
    basketId: basket.id,
    productId: bread.id,
    quantity: 1
  }, models.BasketLine)

  const gotCustomer = await models.Customer
    .query()
    .eager('[basket.lines.product]')
    .findById(customer.id)

  const gotBasket = await models.Basket
    .query()
    .eager('[lines.product, customer]')
    // .eager('lines')
    .findById(basket.id)

  const gotBasketLine = await models.BasketLine
    .query()
    .eager('product')
    // .eager('lines')
    .findById(line1.id)

  console.log(line1, line2, gotCustomer, gotBasket, gotBasketLine)
}

async function createStudents (models) {
  const studentType1 = await assertInsert({
    name: 'grad'
  }, models.StudentType)

  const studentType2 = await assertInsert({
    name: 'postgrad'
  }, models.StudentType)

  const student1 = await assertInsert({
    name: 'Stuart Dent',
    description: 'Notes',
    age: 18,
    typeId: studentType1.id
  }, models.Student)

  const student2 = await assertInsert({
    name: 'Sally Dent',
    description: 'Notes',
    age: 41,
    typeId: studentType2.id
  }, models.Student)

  const course1 = await assertInsert({
    name: 'Maths',
    description: 'Notes',
    content: 'Calculus'
  }, models.Course)

  const course2 = await assertInsert({
    name: 'Science',
    description: 'Notes',
    content: 'Chemistry'
  }, models.Course)

  const course3 = await assertInsert({
    name: 'English',
    description: 'Notes',
    content: 'Literature'
  }, models.Course)

  const enrollment1 = await assertInsert({
    studentId: student1.id,
    courseId: course1.id,
    start: '2000-01-01',
    end: '2001-01-01'
  }, models.Enrollment)

  const enrollment2 = await assertInsert({
    studentId: student1.id,
    courseId: course2.id,
    start: '2000-01-01',
    end: '2001-01-01'
  }, models.Enrollment)

  const enrollment3 = await assertInsert({
    studentId: student2.id,
    courseId: course1.id,
    start: '2000-01-01',
    end: '2001-01-01'
  }, models.Enrollment)

  const enrollment4 = await assertInsert({
    studentId: student2.id,
    courseId: course2.id,
    start: '2000-01-01',
    end: '2001-01-01'
  }, models.Enrollment)

  const enrollment5 = await assertInsert({
    studentId: student2.id,
    courseId: course3.id,
    start: '2000-01-01',
    end: '2001-01-01'
  }, models.Enrollment)

  console.log(student1, student2, course1, course2, course3, enrollment1, enrollment2, enrollment3, enrollment4, enrollment5)
}

async function createPersonPetsData (models) {
  const jon = await models.Person
    .query()
    .insert({
      firstName: 'Jon',
      lastName: 'Doe',
      age: 21,
      ni: Math.random().toString(36).substring(2, 10),
      latLong: {
        latitude: 45,
        longitude: 45
      }
    })

  const sooty = await models.Pet
    .query()
    .insert({
      name: 'Sooty',
      ownerId: jon.id,
      dob: '1996-01-01',
      description: 'Black and White like Jess the cat'
    })

  console.log(sooty instanceof models.Pet) // --> true
  console.log(sooty.name) // --> 'Sooty'

  console.log(jon instanceof models.Person) // --> true
  console.log(jon.firstName) // --> 'Jon'

  const pets = await models.Pet
    .query()
    .eager('owner')
    .orderBy('name')

  const people = await models.Person
    .query()
    .eager('pets')

  const graph = await models.Person
    .query()
    .insertGraph({
      title: 'Mrs',
      firstName: 'Jane',
      lastName: 'Doe',
      age: 20,
      ni: Math.random().toString(36).substring(2, 10),
      latLong: {
        latitude: 45,
        longitude: 45
      },
      pets: [{
        name: 'Sooty1',
        dob: '1997-01-01',
        description: 'Black and White like Jess the cat1'
      }]
    })

  const gotJon = await models.Person
    .query()
    .findById(jon.id)
    .eager('pets')

  const sooty2 = await gotJon
    .$relatedQuery('pets')
    .insert({
      name: 'Sooty2',
      ownerId: gotJon.id, // todo
      dob: '1997-01-01',
      description: 'Black and White like Jess the cat2'
    })

  console.log(pets, people, graph, sooty2)
}

// testCreateDB()
testCreateModels()

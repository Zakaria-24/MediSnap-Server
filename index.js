const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  // console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rfjtmur.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    const db = client.db('MediSnap')
    const usersCollection = db.collection('users')
    const categoriesCollection = db.collection('categories')
    const medicinesCollection = db.collection('medicines')
    const advertisementsCollection = db.collection('advertisements')

      // verify admin middleware
      const verifyAdmin = async (req, res, next) => {
        console.log('hello')
        const user = req.user
        const query = { email: user?.email }
        const result = await usersCollection.findOne(query)
        console.log(result?.role)
        if (!result || result?.role !== 'admin')
          return res.status(401).send({ message: 'unauthorized access!!' })
  
        next()
      }
      // verify host middleware
      const verifySeller = async (req, res, next) => {
        // console.log('hello')
        const user = req.user
        const query = { email: user?.email }
        const result = await usersCollection.findOne(query)
        console.log(result?.role)
        if (!result || result?.role !== 'seller') {
          return res.status(401).send({ message: 'unauthorized access!!' })
        }
  
        next()
      }



    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        // console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })


    // save a user data in db
    app.post('/user', async (req, res) => {
      const addUser = req.body;
      const query = {email: addUser?.email}
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await usersCollection.insertOne(addUser);
      res.send(result)
    })

    // save a medicine data in db
    app.post('/medicine', async (req, res) => {
      const addMedicine = req.body;
      const result = await medicinesCollection.insertOne(addMedicine);
      res.send(result)
    })

    // save a advertisement data in db
    app.post('/advertisement', async (req, res) => {
      const addAdvertisement = req.body;
      const result = await advertisementsCollection.insertOne(addAdvertisement);
      res.send(result)
    })

    // save a category data in db
    app.post('/category', async (req, res) => {
      const addCategory = req.body;
      const result = await categoriesCollection.insertOne(addCategory);
      res.send(result)
    })

    // get all medicines data
    app.get('/medicines', async (req, res) => {
      const result = await medicinesCollection.find().toArray()
      res.send(result)
    })

      // get a user info by email from db
      app.get('/user/:email', async (req, res) => {
        const email = req.params.email
        const result = await usersCollection.findOne({ email })
        res.send(result)
      })

      // Admin related api
      // get all categories info. by specific admin email from db
      app.get('/categories/:email', verifyToken, verifyAdmin, async (req, res) => {
        const email = req.params.email
        const query = { adminEmail : email}
        // console.log(query)
        const result = await categoriesCollection.find(query).toArray()
        // console.log(result)
        res.send(result)
      })

      // get all users data from db for admin management page 
      app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
        const result = await usersCollection.find().toArray()
        res.send(result)
      })


      // seller related api
      // get all medicines info. by specific seller email from db
      app.get('/medicines/:email', verifyToken, verifySeller, async (req, res) => {
        const email = req.params.email
        const query = { addederEmail : email}
        // console.log(email)
        const result = await medicinesCollection.find(query).toArray()
        res.send(result)
      })

      // get all advertisements info. by specific seller email from db
      app.get('/advertisements/:email', verifyToken, verifySeller, async (req, res) => {
        const email = req.params.email
        const query = { sellerEmail : email}
        // console.log(email)
        const result = await advertisementsCollection.find(query).toArray()
        res.send(result)
      })

// update a user role 
      app.patch('/user/:email', verifyToken, verifyAdmin, async (req, res) => {
        const email = req.params.email
        const query = { email: email }
        const updateUser = req.body
        const updateDoc = {
          $set: updateUser
        }
        const result = await usersCollection.updateOne(query, updateDoc)
        res.send(result)
      })
      
      // update a category from categories collection
      app.put('/category/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const updateCategory = req.body
        const updateDoc = {
          $set: updateCategory
        }
        const result = await categoriesCollection.updateOne(query, updateDoc)
        res.send(result)
      })



      // delete a category from categories collection
      app.delete('/category/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await categoriesCollection.deleteOne(query)
        // {_id: new ObjectId(req.params.id)}
        res.send(result)
      })


    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from MediSnap Server..')
})

app.listen(port, () => {
  console.log(`MediSnap is running on port ${port}`)
})
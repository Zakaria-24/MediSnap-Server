const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
// const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const port = process.env.PORT || 8000

// middleware
// const corsOptions = {
//   origin: ['http://localhost:5173', 'http://localhost:5174'],
//   credentials: true,
//   optionSuccessStatus: 200,
// }
app.use(cors())

app.use(express.json())
// app.use(cookieParser())

// Verify Token Middleware
// const verifyToken = async (req, res, next) => {
//   const token = req.cookies?.token
//   // console.log(token)
//   if (!token) {
//     return res.status(401).send({ message: 'unauthorized access' })
//   }
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       console.log(err)
//       return res.status(401).send({ message: 'unauthorized access' })
//     }
//     req.user = decoded
//     next()
//   })
// }

const verifyToken =async (req,res,next) => {
  console.log('inside verify token',req.headers.authorization);
  if(!req.headers.authorization){
    return res.status(401).send({message:'unauthorized access'})
  }
  const token = req.headers.authorization.split(' ')[1]
  console.log(process.env.ACCESS_TOKEN_SECRET)
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message:'bed request invalid token'})
    }
    req.decoded = decoded;
    next();
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
    const addToCartsCollection = db.collection('addToCarts')
    const paymentsCollection = db.collection('payments')

      // verify admin middleware
      // const verifyAdmin = async (req, res, next) => {
      //   console.log('hello')
      //   const user = req.user
      //   const query = { email: user?.email }
      //   const result = await usersCollection.findOne(query)
      //   console.log(result?.role)
      //   if (!result || result?.role !== 'admin')
      //     return res.status(401).send({ message: 'unauthorized access!!' })
  
      //   next()
      // }


      //verify admin
  const verifyAdmin = async(req,res,next) => {
    const email = req.decoded.email;
    console.log('inside',email);
    const query = {email: email};
    const user = await usersCollection.findOne(query);
    const isAdmin = user?.role === 'admin'
    if(!isAdmin){
      return res.status(403).send({message:'forbidden access'})
    }
    next();
  }

      // verify host middleware
      // const verifySeller = async (req, res, next) => {
      //   // console.log('hello')
      //   const user = req.user
      //   const query = { email: user?.email }
      //   const result = await usersCollection.findOne(query)
      //   console.log(result?.role)
      //   if (!result || result?.role !== 'seller') {
      //     return res.status(401).send({ message: 'unauthorized access!!' })
      //   }
  
      //   next()
      // }

      const verifySeller = async(req,res,next) => {
        const email = req.decoded.email;
        console.log('inside',email);
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role === 'seller'
        if(!isAdmin){
          return res.status(403).send({message:'forbidden access'})
        }
        next();
      }
  
      // verify host middleware
      // const verifyUser = async (req, res, next) => {
      //   // console.log('hello')
      //   const user = req.user
      //   const query = { email: user?.email }
      //   const result = await usersCollection.findOne(query)
      //   console.log(result?.role)
      //   if (!result || result?.role !== 'user') {
      //     return res.status(401).send({ message: 'unauthorized access!!' })
      //   }
  
      //   next()
      // }

      const verifyUser = async(req,res,next) => {
        const email = req.decoded.email;
        console.log('inside',email);
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role === 'user'
        if(!isAdmin){
          return res.status(403).send({message:'forbidden access'})
        }
        next();
      }

    // auth related api
    // app.post('/jwt', async (req, res) => {
    //   const user = req.body
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    //     expiresIn: '365d',
    //   })
    //   res
    //     .cookie('token', token, {
    //       httpOnly: true,
    //       secure: process.env.NODE_ENV === 'production',
    //       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    //     })
    //     .send({ success: true })
    // })

    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:'1h',
      })
      res.send({token})
    })

    // Logout
    // app.get('/logout', async (req, res) => {
    //   try {
    //     res
    //       .clearCookie('token', {
    //         maxAge: 0,
    //         secure: process.env.NODE_ENV === 'production',
    //         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    //       })
    //       .send({ success: true })
    //     // console.log('Logout successful')
    //   } catch (err) {
    //     res.status(500).send(err)
    //   }
    // })




    // for payment methods
        // create-payment-intent
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
          const price = req.body.price
          const priceInCent = parseInt(price) * 100
          if (!price || priceInCent < 1) return
          // generate clientSecret
          const { client_secret } = await stripe.paymentIntents.create({
            amount: priceInCent,
            currency: 'usd',
            // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
            automatic_payment_methods: {
              enabled: true,
            },
          })
          // send client secret as response
          res.send({ clientSecret: client_secret })
        })

        // save a payment data in paymentCollection
        app.post('/payment', verifyToken, verifyUser, async (req, res) => {
          const payment = req.body;
          const result = await paymentsCollection.insertOne(payment);
          res.send(result)
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

    // // save a selected cart in addToCartsCollection
    app.post('/selectedCart', async (req, res) => {
      const addSelectedCart = req.body;
      const result = await addToCartsCollection.insertOne(addSelectedCart);
      res.send(result)
    })

    // get all medicines data
    app.get('/medicines', async (req, res) => {
      const result = await medicinesCollection.find().toArray()
      res.send(result)
    })

    // get a medicine data by specific id
    app.get('/mediDetails/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await medicinesCollection.findOne(query)
      // console.log(result)
      res.send(result)
    })

      // get a user info by email from db
      app.get('/user/:email', async (req, res) => {
        const email = req.params.email
        const result = await usersCollection.findOne({ email })
        res.send(result)
      })

      // Admin related api

      // get all payment 
      app.get('/adminPaidRevenue', verifyToken, verifyAdmin, async (req, res) => {
        const query = { status: "paid"}
        const result = await paymentsCollection.find(query).toArray()
        res.send(result)
      })
      app.get('/adminPendingRevenue', verifyToken, verifyAdmin, async (req, res) => {
        const query = { status: "pending"}
        const result = await paymentsCollection.find(query).toArray()
        res.send(result)
      })




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

      // get all advertisements data from advertisementsCollection db for admin management page
      app.get('/manageAdvertisements', verifyToken, verifyAdmin, async (req, res) => {
        const result = await advertisementsCollection.find().toArray()
        res.send(result)
      })

      // get all payment data with filtering status: "paid" from payments collection
      app.get('/seles', verifyToken, verifyAdmin, async (req, res) => {
        const query = { status: "paid"}
        const result = await paymentsCollection.find(query).toArray()
        res.send(result)
      })


      // seller related api

       // get all payment 
       app.get('/sellerPaidRevenue/:email', verifyToken, verifySeller, async (req, res) => {
        const email = req.params.email
        // const filter = { sellerEmail: email}
        // const query = {
        //   "filter?.status": "paid"}
        const query = { 
          sellerEmail: email,
          status: "paid"}
          // console.log(query)
        const result = await paymentsCollection.find(query).toArray()
        res.send(result)
        // console.log(result)
      })
      app.get('/sellerPendingRevenue/:email', verifyToken, verifySeller, async (req, res) => {
        const email = req.params.email
        const query = { 
          sellerEmail: email,
          status: "pending"}
          // console.log(query)
        const result = await paymentsCollection.find(query).toArray()
        res.send(result)
      })



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


      // Home{ category section api}

// get all catgory data from categoriesCollection
   app.get('/categories', async (req, res) => {
    const result = await categoriesCollection.find().toArray()
    res.send(result)
  })

// get all catgory data related to specified categoryName
   app.get('/specificCategories/:categoryName',  async (req, res) => {
    const categoryName = req.params.categoryName
    const filter = { categoryName: categoryName }
    const result = await categoriesCollection.find(filter).toArray()
    res.send(result)
  })

    // get all advertising data from advertisingCollection db for slider
    app.get('/sliderAdvertisement', async (req, res) => {
      const result = await advertisementsCollection.find().toArray()
      res.send(result)
    })


    // get all medicins data from medicinesCollection db for discount
    app.get('/discount', async (req, res) => {
      const query = { discountPercentage: {$ne: "0"} }
      const result = await medicinesCollection.find(query).toArray()
      res.send(result)
    })

    // get categorydata for categoryDetails page
    app.get('/ctgDetails/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await categoriesCollection.findOne(query)
      res.send(result)
    })


    // get selected Related deta for categoryDetails page
    app.get('/categoryDetails/:categoryName', async (req, res) => {
      const categoryName = req.params.categoryName
      const query = { categoryName: categoryName}
      const result = await categoriesCollection.find(query).toArray()
      res.send(result)
    })

    // get all selected carts by specific user email
    app.get('/selectedCarts/:email', verifyToken, verifyUser, async (req, res) => {
      const email = req.params.email
      const query = { selecterEmail: email }
      const result = await addToCartsCollection.find(query).toArray()
      res.send(result)
    })

    // get all payments history for admin
    app.get('/adminPaymentHistory', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentsCollection.find().toArray()
      res.send(result)
    })

    // get all payments history for seller
    app.get('/sellerPaymentHistory', verifyToken, verifySeller, async (req, res) => {
      const result = await paymentsCollection.find().toArray()
      res.send(result)
    })

    // get all payments history by specific user email
    app.get('/userPaymentHistory/:email', verifyToken, verifyUser, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await paymentsCollection.find(query).toArray()
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

// update a advertisement status 
      app.patch('/advertisement/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const updateStatus = req.body
        const updateDoc = {
          $set: updateStatus
        }
        const result = await advertisementsCollection.updateOne(query, updateDoc)
        res.send(result)
      })
      
// update a massUnit quantity  
      app.patch('/massUnit/:id', verifyToken, verifyUser, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const updateStatus = req.body
        const updateDoc = {
          $set: updateStatus
        }
        const result = await addToCartsCollection.updateOne(query, updateDoc)
        res.send(result)
      })

// update a payment history status from admin page
      app.patch('/paymentStatus/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const updateStatus = req.body
        const updateDoc = {
          $set: updateStatus
        }
        const result = await paymentsCollection.updateOne(query, updateDoc)
        res.send(result)
      })


      
    //   // update Room Status
    // app.patch('/payment/status/:transactionId', async (req, res) => {
    //   const transactionId = req.params.transactionId
    //   const status = req.body
    //   // change room availability status
    //   const query = { transactionId: transactionId }
    //   const updateDoc = {
    //     $set: status,
    //   }
    //   const result = await roomsCollection.updateOne(query, updateDoc)
    //   res.send(result)
    // })


      
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
   
      // delete a selected category from user by specific id in addToCartCollection
      app.delete('/cart/:id', verifyToken, verifyUser, async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await addToCartsCollection.deleteOne(query)
        // {_id: new ObjectId(req.params.id)}
        res.send(result)
      })


    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    // console.log(
    //   'Pinged your deployment. You successfully connected to MongoDB!'
    // )
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
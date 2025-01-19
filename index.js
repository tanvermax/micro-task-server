const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json());
app.use(cookieParser());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.toqnk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const userCollection = client.db('earnly').collection("users");
    // admin api
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          role: "admin"
        }
      }
      const result = await userCollection.updateOne(filter, updatedData);
      res.send(result);

    })
    // middlewere
    const verifytoken = (req, res, next) => {
      console.log("inside verytoken", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (error, decodeed) => {
        if (error) {
          return res.status(401).send({ message: 'forbidden access' })
        }
        req.decodeed = decodeed;
        next();
      })


    }
    //   app.patch('/users/admin/:id', async (req, res) => {
    //     const id = req.params.id;
    //     const filter = { _id: new ObjectId(id) };
    //     const updatedData = { $set: { role: 'admin' } };
    //     const result = await userCollection.updateOne(filter, updatedData);
    //     res.send(result);
    // });

    // jwt token
    app.post('/jwt', (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '5h' })
        res.cookie('access-token', token);
        res.json({ message: 'token generated successfully', token })
      } catch (error) {
        console.error('error genereted JWT:', error);
        res.status(500).json({ error: 'INternal server Error' })

      }

    })

    // get user api

    app.get('/users', verifytoken, async (req, res) => {
      console.log(req.headers);

      const email = req.query.email;

      // If email is provided, find the specific user by email
      if (email) {
        const user = await userCollection.findOne({ email: email });

        if (user) {
          res.send(user); // Send back the user data
        } else {
          res.status(404).send({ message: 'User not found' }); // Handle case where user is not found
        }
      } else {
        // If no email is provided, return all users
        const cursor = userCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      }
    });


    // app.post('/users',async(req,res)=>{
    //   const newuser = req.body;
    //   const result = await userCollection.insertOne(newuser); 
    //   res.send(result);
    // })
    // usedelet
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // new useer


    app.post("/users", async (req, res) => {

      try {
        const newuser = req.body;
        const query = { email: newuser.email }
        const existinguser = await userCollection.findOne(query)
        if (existinguser) {
          return res.send({ message: 'user already axists', insertedId: null })
        } // Get user data from the request body
        const result = await userCollection.insertOne(newuser); // Insert user into the database
        res.send(result); // Send the result back to the client
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Failed to insert user" }); // Handle errors gracefully
      }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('earnly is running')
})

app.listen(port, () => {
  {
    console.log(`earnly run on post ${port}`);

  }
})
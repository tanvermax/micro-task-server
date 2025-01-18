const express = require('express');

const app = express();
const cors= require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');
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
// get user api

app.get('/users', async (req,res)=>{
  const cursor = userCollection.find()
  const result = await cursor.toArray();
  res.send(result);
})
    // new useer
    app.post("/users", async (req, res) => {
      try {
        const newuser = req.body; // Get user data from the request body
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
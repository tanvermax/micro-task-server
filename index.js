const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_TOKEN_SECREC)

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
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });


    const userCollection = client.db('earnly').collection("users");
    const taskCollection = client.db('earnly').collection("task");
    const submitCollection = client.db('earnly').collection("submitted");
    const withdrawtCollection = client.db('earnly').collection("transitions");
    const trasnsitCollection = client.db('earnly').collection("usertransiction");
    const notificationCollection = client.db('earnly').collection("notification");



    const verifyworker = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      try {
        const user = await userCollection.findOne(query);
        if (user?.role !== 'worker') {
          return res.status(403).send({ message: 'Forbidden : Worker only' })
        }
        next()
      }
      catch (error) {
        res.status(500).send({ message: 'server error', error })
      }
    }
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;  // Extract email from decoded token
      const query = { email: email };

      // Fetch user from database
      const user = await userCollection.findOne(query);

      if (!user) {
        return res.status(404).send({ message: 'User not found' });
      }

      // Check if user has admin role
      const isAdmin = user.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden access: You are not an admin' });
      }

      next();
    };

    const verifybuyer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };


      const user = await userCollection.findOne(query);
      if (!user) {
        return res.status(404).send({ message: 'User not found' });
      }
      const isBuyer = user.role === 'buyer';
      if (!isBuyer) {
        return res.status(403).send({ message: 'Forbidden access: You are not an buyer' })
      }

      // const isAdmin = user.role === 'admin';

      next()
    }






    const verifytoken = (req, res, next) => {
      // console.log("inside verytoken", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unathorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
      })
    }


    // withsreaw
    app.post('/withdrawals',verifytoken, async (req, res) => {
      const taskitem = req.body;
      const result = await withdrawtCollection.insertOne(taskitem);
      res.send(result);
    })


    app.get('/withdrawals',verifytoken, async (req, res) => {
      const result = await withdrawtCollection.find().toArray();
      // console.log("the data",result);
      
      res.send(result);
    })




    app.patch('/withdrawals/:id',verifytoken, async (req, res) => {
      const id = req.params.id;
      console.log(id);

      try {

        const filter = { _id: new ObjectId(id) };
        // Convert to ObjectId
        const updatedData = {
          $set: { status: "approve" },
        };
        const result = await withdrawtCollection.updateOne(filter, updatedData);
        if (result.modifiedCount === 0) {
          return res.status(400).send({ error: "No document found or already approved" });
        }

        const updatedSubmission = await withdrawtCollection.findOne(filter);
        const userEmail = updatedSubmission.worker_email;

        // console.log(updatedSubmission);

        const coinAmount = parseInt(updatedSubmission.withdrawal_coin);

        const userFilter = { email: userEmail };
        console.log(userFilter);

        const coinUpdate = {
          $inc: { coins: -coinAmount },
        };
        const userResult = await userCollection.updateOne(userFilter, coinUpdate);

        res.send({
          message: 'Submission approved and coins updated successfully',
          submissionResult: updatedSubmission,
          userResult: userResult,
        });
      } catch (error) {
        console.error("Error updating submission:", error);
        res.status(500).send({ error: "Failed to update submission" });
      }


    })
    // tasnsition list
    // app.get('/transit', async (req, res) => {
    //   // const taskitem = req.body;
    //   const result = await trasnsitCollection.find().toArray();
    //   res.send(result);
    // })

    // trasnsictioin
    app.post('/transit', verifytoken, async (req, res) => {
      const taskitem = req.body;
      const result = await trasnsitCollection.insertOne(taskitem);
      res.send(result);
    })


    app.post('/newnotificatio',verifytoken, async (req, res) => {
      const notifi = req.body;
      const result = await notificationCollection.insertOne(notifi);
      res.send(result);
    })

    app.get('/newnotificatio', async (req, res) => {
      const transit = await notificationCollection.find().toArray();
      res.send(transit)
    })




    // get payment info al
    app.get('/transit', async (req, res) => {
      const transit = await trasnsitCollection.find().toArray();
      res.send(transit)
    })


    //creat trasniction history
    app.post("/createpaymentintent", verifytoken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside intent");



      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, // In cents
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret

      });

    });

    // Save Payment and Update Coins:
    app.post("/payments",verifytoken, async (req, res) => {
      const { paymentId, amount, userId, coinAmount } = req.body;

      try {
        // Save payment to the database
        await db.collection("payments").insertOne({
          paymentId,
          amount,
          userId,
          coinAmount,
          date: new Date(),
        });

        // Update user coins
        await db.collection("users").updateOne(
          { _id: userId },
          { $inc: { coins: coinAmount } }
        );

        res.status(200).json({ message: "Payment successful and coins updated." });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });
    // rejected

    // try {
    //   const result = await submitCollection.insertOne(submititem);
    //   const taskUpdateresult = await taskCollection.updateOne(
    //     { _id: new ObjectId(task_id) },
    //     { $inc: { requiredWorkers: -1 } }

    //   )
    //   // console.log(taskUpdateresult);



    //   res.send({
    //     message: 'Submission created and task updated successfully',
    //     submissionResult: result,
    //     taskUpdateresult: taskUpdateresult,
    //   });
    // } catch (error) {
    //   console.error('Error creating submission or updating task:', error);
    //   res.status(500).send({ error: 'Failed to create submission or update task' });
    // }

    app.patch('/submitted/reject/:id', verifytoken, async (req, res) => {
      const id = req.params.id;
      try {
        const submission = await submitCollection.findOne({ _id: new ObjectId(id) });
        if (!submission) {
          return res.status(404).send({ error: "Submission not found" });
        }

        const { task_id } = submission;

        const filter = { _id: new ObjectId(id) };

        // Convert to ObjectId
        const updatedData = {
          $set: { status: "reject" },
        };


        const result = await submitCollection.updateOne(filter, updatedData);
        const taskUpdateresult = await taskCollection.updateOne(
          { _id: new ObjectId(task_id) },
          { $inc: { requiredWorkers: +1 } }

        )
        // console.log(taskUpdateresult);
        res.send({
          message: 'Submission created and task updated successfully',
          submissionResult: result,
          taskUpdateresult: taskUpdateresult,
        });
      } catch (error) {
        console.error("Error updating submission:", error);
        res.status(500).send({ error: "Failed to update submission" });
      }
    });



    app.patch('/submitted/:id',verifytoken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);

      try {
        const filter = { _id: new ObjectId(id) }; // Convert to ObjectId
        const updatedData = {
          $set: { status: "approve" },
        };
        // console.log(filter);
        // console.log(updatedData);

        const submission = await submitCollection.updateOne(filter, updatedData);
        if (submission.modifiedCount === 0) {
          return res.status(404).send({ message: 'Submission not found or already updated' });
        }
        const updatedSubmission = await submitCollection.findOne(filter);
        const userEmail = updatedSubmission.worker_email;
        const coinincr = parseInt(updatedSubmission.payable_amount);

        const userFilter = { email: userEmail };
        const coinUpdate = {
          $inc: { coins: coinincr },
        };

        const userResult = await userCollection.updateOne(userFilter, coinUpdate);
        res.send({
          message: 'Submission approved and coins updated successfully',
          submissionResult: updatedSubmission,
          userResult: userResult,
        });
      } catch (error) {
        console.error("Error updating submission:", error);
        res.status(500).send({ error: "Failed to update submission" });
      }
    });

    // all submitted api 


    // app.get('/users/worker', async (req, res) => {
    //   const { role } = req.query;
    //   const workers = await User.find({ role })
    //     .sort({ coins: -1 }); // Sort by coins in descending order
    //   res.json(workers);
    // });


    // submitted from worker
    app.post('/tasksubmit', verifytoken, async (req, res) => {
      const submititem = req.body;
      const { task_id } = submititem;
      console.log(submititem);
      console.log(task_id);


      try {
        const result = await submitCollection.insertOne(submititem);
        const taskUpdateresult = await taskCollection.updateOne(
          { _id: new ObjectId(task_id) },
          { $inc: { requiredWorkers: -1 } }

        )
        // console.log(taskUpdateresult);



        res.send({
          message: 'Submission created and task updated successfully',
          submissionResult: result,
          taskUpdateresult: taskUpdateresult,
        });
      } catch (error) {
        console.error('Error creating submission or updating task:', error);
        res.status(500).send({ error: 'Failed to create submission or update task' });
      }
    });


    // create payment
    app.patch("/users",verifytoken, async (req, res) => {
      try {
        const { email, coins } = req.body;

        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const result = await userCollection.updateOne(
          { email }, // Query to find the user
          { $set: { coins } } // Update user's coins
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User coins updated", coins });
      } catch (error) {
        console.error("Error updating user coins:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // update user coin 
    app.patch('/users/:email',verifytoken, async (req, res) => {
      const { email } = req.params;
      const { coins } = req.body;

      try {
        const result = await userCollection.updateOne(
          { email },
          { $set: { coins } }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Coins updated successfully." });
        } else {
          res.send({ success: false, message: "Failed to update coins." });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error." });
      }
    });

    app.get("/submitted", async (req, res) => {

      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const userEmail = req.query.userEmail;
      const filter = { worker_email: userEmail }
      console.log('pagination query', page, size, userEmail);
      // console.log('pagination query', page, size);
      const result = await submitCollection.find(filter).skip(page * size).limit(size).toArray();
      res.send(result);
    })

    app.get("/totoalsubmitted", async (req, res) => {
      const result = await submitCollection.find().toArray();
      res.send(result);
    })


    app.get("/subar", async (req, res) => {
      const result = await submitCollection.find().toArray();
      res.send(result);
    });

    // app.get("/task", async (req, res) => {
    //   const result = await taskCollection.find().toArray();
    //   res.send(result);
    // })


    // for pagination
    app.get('/submitCount', async (req, res) => {
      const count = await submitCollection.estimatedDocumentCount();
      console.log(count);

      res.send({ count });
    })



    // delete task data
    app.delete('/task/:id',verifytoken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    })
    // create individual task cllect 
    app.get('/task/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const task = await taskCollection.findOne(query);
      res.send(task);
    })
    // update task field api
    app.put("/task/:id", verifytoken, async (req, res) => {
      const taskId = req.params.id;
      const updatedData = req.body;

      try {
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(taskId) },
          { $set: updatedData }
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).send({ error: "Failed to update task" });
      }
    });

    // all task api 
    app.get("/task", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    })


    // task api 
    app.post('/task', verifytoken, async (req, res) => {
      const taskitem = req.body;
      const result = await taskCollection.insertOne(taskitem);
      res.send(result);
    })

    //for making admin api

    app.patch('/users/admin/:id', verifytoken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const validROls = ['admin', 'worker', 'buyer'];
      if (!validROls.includes(role)) {
        return res.status(400).send({ error: "Invalid role provided" });
      }
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          role: role
        }
      }
      try {
        const result = await userCollection.updateOne(filter, updatedData);
        if (result.modifiedCount > 0) {
          res.send({ success: true, message: `Role updated to ${role}` });
        } else {
          res.status(404).send({ success: false, message: "User not found or role unchanged" });
        }
      } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).send({ success: false, message: "Internal server error" });
      }
    })




    app.patch('/users/coins/:id', verifytoken, async (req, res) => {
      const id = req.params.id;
      const { coins } = req.body;
      if (coins === undefined) {
        return res.status(400).send({ success: false, message: "Coins value is required." });
      }
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: { coins },
      };
      try {
        const result = await userCollection.updateOne(filter, updatedData);
        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Coins updated successfully." });
        } else {
          res.send({ success: false, message: "No changes made or user not found." });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: "Error updating coins.", error });
      }
    });

    // middlewere




    // for admin
    app.get('/users/admin/:email', verifytoken, async (req, res) => {
      const email = req.params.email;
      console.log("from line", req.decoded);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })



    // for worker 
    app.get('/users/admin/:email', verifytoken, async (req, res) => {
      const email = req.params.email;
      console.log("from line", req.decoded);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let worker = false;
      if (user) {
        worker = user?.role === 'worker'
      }
      res.send({ worker })
    })


    app.get('/users/admin/:email', verifytoken, async (req, res) => {
      const email = req.params.email;
      console.log("from line", req.decoded);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let buyer = false;
      if (user) {
        buyer = user?.role === 'buyer'
      }
      res.send({ buyer })
    })



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

    app.get('/users/role', verifytoken, async (req, res) => {
      console.log(req.headers);

      const { role } = req.query;

      try {
        const filter = {};
        if (role) filter.role = role;
        // if (email) filter.email = email;


        const users = await userCollection.find(filter).limit(6).toArray();
        const sortedUser = users.sort((a, b) => b.coins - a.coins)
        // For multiple users
        res.send(sortedUser);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ error: 'Failed to fetch users' });
      }
    });


    app.get('/users', verifytoken, async (req, res) => {
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



    // usedelet
    app.delete('/users/:id', verifytoken, verifyAdmin, async (req, res) => {
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
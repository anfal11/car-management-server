const express = require('express')
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookirParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], 
  credentials: true,
}));
app.use(express.json());
app.use(cookirParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ey8cr7h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// middlewares
const logger = async (req, res, next) => {
    // console.log('log info:', req.method, req.url);
  next();
}


const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log('token in the middleware', token);
  // no tokena available
  if(!token){
    return res.status(401).send({message: 'Unauthorized access'});
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>
   {
    if(err){
      return res.status(403).send({message: 'unauthoried access'});
    }
    req.user = decoded;
    next();
  });
  // next();
}


async function run() {
  try {
    await client.connect();

    const serviceCollection = client.db("carManagement").collection("services");
    const bookingCollection = client.db("carManagement").collection("bookings");


    // auth related api
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      // console.log('token', token, 'user', user);

      // res.send({token});
      res
      .cookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      })
      .send({success: true});
    })

    app.post('/logout', async (req, res) => {
      const user = req.body;
      // console.log('logging out', user);
      res
      .clearCookie('token', 
      {maxAge: 0})
      .send({success: true});
    })
    // services
    app.get("/services", async (req, res) =>{
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    } )

    app.get("/services/:id", async (req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const options = {
            projection: { title: 1, price: 1, service_id: 1, img: 1 },
          };
        const result = await serviceCollection.findOne(query, options);
        res.send(result);
    })

    // bookings

    app.get("/bookings", logger, verifyToken,  async (req, res) =>{
        // console.log(req.query.email);
        // console.log('token owner info', req.user);
        if(req.user.email !== req.query.email){
            return res.status(403).send({message: 'Forbidden access'});
        }
        let query = {};
        if(req.query?.email){
            query = {email: req.query.email};
        }
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
    })

    app.post("/bookings", async (req, res) =>{
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
    })

    app.patch("/bookings/:id", async (req, res) =>{
        const id = req.params.id;
        const updatedBooking = req.body;
        const filter = {_id: new ObjectId(id)};
        const updateDoc = {
            $set: {
                status: updatedBooking.status
            },
          };
        const result = await bookingCollection.updateOne(filter, updateDoc);
        res.send(result);
    })

    app.delete("/bookings/:id", async (req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
    })




    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  
  finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('My car management service is working')
})

app.listen(port, () => {
  console.log(`Car management app's listening on port is ${port}`)
})
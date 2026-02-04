require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;




// Middleware
app.use(cors({
    origin: [
        //'http://localhost:5173',
        'https://car-doctor-7e43e.web.app',
        'https://car-doctor-7e43e.firebaseapp.com',
        //'https://car-doctor-server-lemon-two.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.deftcj8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

//custom middleware to verify JWT
const logger = (req, res, next) => {
    console.log('Logged In User:', req.method, req.url);
    next();
};

const verifyJWT = (req, res, next) => {
    // Read the token from cookies instead of headers
    const token = req.cookies?.token; 
    
    if (!token) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //await client.connect();
        const servicesCollection = client.db('carDoctorDB').collection('services');
        const bookingsCollection = client.db('carDoctorDB').collection('bookings');

        // auth API
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            //console.log('JWT TOKEN:', token);

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none',

                })
                .send({ success: true});
        });

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('Logout user:', user);
            res.clearCookie('token', {maxAge: 0 }).send({ success: true, message: 'Logged out successfully' });
        });

        // Services API
        app.get('/services', async (req, res) => {

            const cursor = servicesCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            }
            const result = await servicesCollection.findOne(query, options);
            res.send(result);
        });


        // Bookings API
        app.get('/bookings', logger, verifyJWT,  async (req, res) => {
            console.log(req.query.email);
            console.log(req.cookies.token); 
            console.log('token owner info', req.decoded);
            if (req.decoded.email !== req.query.email) {
                return res.status(403).send({ error: 1, message: 'forbidden access' });
            }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            //console.log(booking);
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;
            //console.log(updatedBooking);
            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                },
            };
            const result = await bookingsCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        });
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);


// Sample route
app.get('/', (req, res) => {
    res.send('Car Doctor Server is running');
});



if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  });
}


module.exports = app;

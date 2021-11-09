const express = require('express');
const admin = require("firebase-admin");
const cors = require('cors');
const { MongoClient } = require('mongodb');



const port = process.env.PORT || 5000;



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const app = express();
app.use(cors());
app.use(express.json())
require('dotenv').config();


app.get('/', (req, res) => {
    res.send('hello bro')
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yu5z2.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers.authorization?.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }

    next();
}


async function run() {
    try {
        await client.connect();
        console.log('database conected')
        const database = client.db("doctors_portal");
        const appointmentCollection = database.collection("booking_appointment");
        const userCollection = database.collection('users');


        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            // const date = req.query.date.toLocaleDateString();
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { patientEmail: email, date: date }
            const cursor = appointmentCollection.find(query)
            const appointments = await cursor.toArray();
            res.send(appointments)
        })



        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }

            res.send({ admin: isAdmin })
        })


        // post for appointments 
        app.post('/appointments', async (req, res) => {

            const appointment = req.body;
            const result = await appointmentCollection.insertOne(appointment);
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            console.log(result)
            res.send(result);
        })


        // update for google or handle or google 
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })



        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await userCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await userCollection.updateOne(filter, updateDoc);
                    res.send(result)
                }
            }
            else {
                res.status(403).send({ message: 'you can not make admin' })
            }


        })

    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir)


app.listen(port, () => {
    console.log('i am ', port)
})


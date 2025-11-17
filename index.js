const express = require("express");
const { MongoClient } = require("mongodb");
// require("dotenv").config();
const app = express();
const port = 5000;
const cors = require('cors');
const session = require("express-session");

app.use(
  cors({
    origin: "https://bismillahdeveloperandtraders.com/",
    credentials: true
  })
);

app.use(session({
  secret: "Bismillah",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
}));

const { ObjectId } = require('mongodb'); 
// MongoDB Atlas connection
const uri = "mongodb+srv://farialmahmodtishan:IMSTEST@web.3j80q.mongodb.net/web?retryWrites=true&w=majority&appName=bismillah";
const dbName = "bismillah";
const collectionName = "shareholders";

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('assets'));

// EJS setup
app.set("view engine", "ejs");
app.set("views", "./views");

function ensureLogin(req, res, next) {
  if (req.session.user) {
    next(); // user logged in
  } else {
    res.redirect("/login");
  }
}

app.get('/', (req, res) => {
  res.render('home');
});

// Existing route - keep this
app.get('/inventory', ensureLogin, (req, res) => {
  res.render('inventory');
});

// Add this new route for purchase history page
app.get('/purchase', ensureLogin, (req, res) => {
  res.render('purchase');
});

// Updated POST route - changed res.render('inventory') to res.redirect('/purchase')
app.post("/purchases", ensureLogin, async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const db = client.db("bismillah");
    const collection = db.collection("inventory");

    // Destructure and clean input data
    const { date, productName, amount, cost, total, status, supplier } = req.body;

    // Validate required fields
    if (!date || !productName || !amount || !cost || !status || !supplier) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newEntry = {
      date,
      productName,
      amount: parseFloat(amount),
      cost: parseFloat(cost),
      total: parseFloat(total) || (parseFloat(amount) * parseFloat(cost)),
      status,
      supplier,
      createdAt: new Date()
    };

    const result = await collection.insertOne(newEntry);
    
    // CHANGED: Redirect to purchase history page after successful save
    res.redirect('/purchase');
    
  } catch (err) {
    console.error("Error inserting document:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// Keep this route as is - it provides the JSON data for the purchase history table
app.get("/purchases", ensureLogin, async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const db = client.db("bismillah");
    const collection = db.collection("inventory");
    const items = await collection.find().sort({ createdAt: -1 }).toArray();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Error fetching data", error: err.message });
  }
});

app.get("/shareholder", ensureLogin, async (req, res) => {
  const { id, doc } = req.query;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);
    const docData = await collection.findOne({ _id: new ObjectId(doc) });

    if (!docData) return res.status(404).send("Shareholder not found");

    const shareholder = docData.shareholder.find(s => s.id == id || s.name == id);

    if (!shareholder) return res.status(404).send("Shareholder not found in document");

    res.render("shareholder", { shareholder });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading shareholder");
  } finally {
    await client.close();
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post("/login", async (req, res) => {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const { mobile, password } = req.body;

  // 1. Input Validation
  if (!mobile || !password) {
    return res.status(400).json({ success: false, message: "Mobile number and password are required." });
  }

  try {
    // 2. Connect to DB and select collection
    await client.connect();
    const db = client.db("bismillah");
    const collection = db.collection("users");

    // 3. Find the document that contains the users array
    const userContainerDocument = await collection.findOne({
      _id: new ObjectId("6908d0a4c001ea692e928b68"),
    });

    if (!userContainerDocument || !userContainerDocument.users) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // 4. Search inside the users array
    const foundUser = userContainerDocument.users.find(
      (u) => u.Mobile === mobile && u.Password === password
    );

    if (!foundUser) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // 5. Create session
    req.session.user = {
      id: foundUser.ID,
      mobile: foundUser.Mobile,
      name: foundUser.Name,
    };

    console.log("✅ Session created:", req.session.user);

    // 6. Send success JSON (frontend handles redirect)
    return res.json({
      success: true,
      message: "Login successful!",
      user: req.session.user,
    });

  } catch (err) {
    console.error("Error during login verification:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  } finally {
    await client.close();
  }
});


app.get("/dashboard", ensureLogin, async (req, res) => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    // Fetch all shareholders
    const docs = await collection.find({}).toArray();

    const dashboardData = [];

docs.forEach((doc) => {
  if (Array.isArray(doc.shareholder)) {
    doc.shareholder.forEach((s) => {
      const firstInstallment = s.payments?.find(p => p.installment_number === 1) || {};

dashboardData.push({
  doc_id: doc._id.toString(),
  id: s.id || s.name,   // ✅ fallback to name
  name: s.name || "-",
  installment_number: firstInstallment.installment_number || "-",
  amount_paid: firstInstallment.amount_paid || 0,
  status: firstInstallment.status || "-",
  payment_date: firstInstallment.payment_date || "-",
  due_date: firstInstallment.last_date || "-"
});

    });
  }
});

    // Pass data to your working EJS template
    res.render("dashboard", { shareholders: dashboardData });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).send("Error loading dashboard");
  } finally {
    await client.close();
  }
});


app.get("/profile", async (req, res) => {
  // 1️⃣ Check if user logged in
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const userId = req.session.user.id;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const db = client.db("bismillah");
    const collection = db.collection("shareholders"); // adjust to your actual collection

    // 2️⃣ If admin (ID = 1), redirect to dashboard
    if (userId === 1) {
      return res.redirect("/dashboard");
    }

    // 3️⃣ For everyone else → load only that user’s shareholder data
    const doc = await collection.findOne({ "shareholder._id": userId });

    if (!doc || !doc.shareholder) {
      return res.status(404).send("❌ Shareholder data not found.");
    }

    const shareholder = doc.shareholder.find(s => s._id === userId);

    if (!shareholder) {
      return res.status(404).send("❌ Shareholder not found.");
    }

    // 4️⃣ Render the profile page
    return res.render("profile", { shareholder });
  } catch (err) {
    console.error("Error loading profile:", err);
    res.status(500).send("⚠️ Server error while loading profile.");
  } finally {
    await client.close();
  }
});


app.post("/update-installment", ensureLogin, async (req, res) => {
  const { shareholderId, installmentNumber, amountPaid, paymentDate, status } = req.body;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Load the document
    const doc = await collection.findOne({ "shareholder._id": parseInt(shareholderId) });
    if (!doc) return res.status(404).send("❌ Shareholder not found.");

    // Find and update the specific shareholder's payments
    const updated = doc.shareholder.map(shareholder => {
      if (shareholder._id === parseInt(shareholderId)) {
        const payments = shareholder.payments.map(payment => {
          if (payment.installment_number === parseInt(installmentNumber)) {
            // Set payment_date to blank string if status is "due"
            const finalPaymentDate = status.toLowerCase() === "due" ? "" : (paymentDate || new Date().toISOString().split("T")[0]);
            
            // Update this specific payment
            return {
              ...payment,
              amount_paid: parseFloat(amountPaid),
              status: status,
              payment_date: finalPaymentDate
            };
          }
          return payment;
        });
        
        return { ...shareholder, payments };
      }
      return shareholder;
    });

    // Replace the entire document
    const result = await collection.replaceOne(
      { _id: doc._id },
      { ...doc, shareholder: updated }
    );

    if (result.modifiedCount > 0) {
      res.send(`✅ Installment ${installmentNumber} updated.`);
    } else {
      res.status(400).send("⚠️ No changes made.");
    }

  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("⚠️ Error updating installment.");
  } finally {
    await client.close();
  }
});


app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send("Error logging out");
    res.redirect("/login");
  });
});


app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
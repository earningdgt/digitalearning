const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000; 

const ADMIN_SECRET_PIN = "9999"; 

// 1. Establish Secure Connection to Cloud Database Engine
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
console.error("CRITICAL RUNTIME WARNING: process.env.MONGO_URI is empty inside Railway variables!");
} 

mongoose.connect(MONGO_URI || "mongodb://localhost:27017/digitalearning")
.then(() => console.log("Database connected successfully! Ready for permanent tracking..."))
.catch(err => console.error("Database initialization fault:", err)); 

// 2. Define Permanent User Data Model Schema
const userSchema = new mongoose.Schema({
username: { type: String, required: true },
phone: { type: String, required: true, unique: true },
password: { type: String, required: true },
role: { type: String, default: "user" },
balance: { type: Number, default: 0 },
referralCount: { type: Number, default: 0 },
referredBy: { type: String, default: null },
investments: { type: Array, default: [] },
withdrawals: { type: Array, default: [] },
transactions: { type: Array, default: [] }
}); 

const User = mongoose.model('User', userSchema); 

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

// 3. Live Endpoint 1: Account Registration Module
app.post('/api/register', async (req, res) => {
const { username, phone, password, referredBy } = req.body;
if (!username || !phone || !password) {
return res.status(400).json({ success: false, message: "Missing required inputs" });
} 

try {
let existingUser = await User.findOne({ phone: phone });
if (existingUser) {
return res.status(400).json({ success: false, message: "An account with this phone number already exists." });
}
let newUser = new User({
    username,
    phone,
    password,
    balance: 0,
    referredBy: referredBy || null
});

if (referredBy) {
    let referrer = await User.findOne({ phone: referredBy });
    if (referrer) {
        referrer.referralCount += 1;
        referrer.balance += 1000; 
        referrer.transactions.push({
            type: "Referral Bonus",
            amount: 1000,
            date: new Date(),
            details: `Invited ${username}`
        });
        await referrer.save();
    }
}

await newUser.save();
res.json({ success: true, user: newUser });

} catch (err) {
res.status(500).json({ success: false, message: "Server database execution error." });
}

}); 

// 4. Live Endpoint 2: Secure Login Verification
app.post('/api/login', async (req, res) => {
const { phone, password } = req.body;
if (!phone || !password) {
return res.status(400).json({ success: false, message: "Missing inputs" });
} 

try {
const user = await User.findOne({ phone: phone });
if (!user) {
return res.status(404).json({ success: false, message: "No account identified with this phone number." });
}
if (user.password !== password) {
    return res.status(401).json({ success: false, message: "Incorrect security credentials." });
}

res.json({ success: true, user });

} catch (err) {
res.status(500).json({ success: false, message: "Server connection failure." });
}

}); 

// 5. Live Endpoint 3: Fetch Single Client Dashboard Profile Metrics
app.get('/api/user/:phone', async (req, res) => {
try {
const user = await User.findOne({ phone: req.params.phone });
if (!user) return res.status(404).json({ success: false, message: "User not found" });
res.json({ success: true, user });
} catch (err) {
res.status(500).json({ success: false, message: "Error fetching data matrix parameters." });
}
}); 

// 6. Live Endpoint 4: Manual Request Logging Matrix
app.post('/api/deposit', async (req, res) => {
const { phone, amount, txId, details } = req.body;
if (!phone || !amount || !txId) {
return res.status(400).json({ success: false, message: "Missing verification payload inputs." });
} 

try {
let user = await User.findOne({ phone: phone });
if (!user) return res.status(404).json({ success: false, message: "User profile not found." });
user.transactions.push({
    type: "Deposit Pending",
    amount: parseInt(amount),
    date: new Date(),
    txRef: txId,
    details: details || `Tx ID: ${txId} - Awaiting Verification`
});

await user.save();
res.json({ success: true, message: "Manual request logged successfully! Awaiting validation check rules." });

} catch (err) {
res.status(500).json({ success: false, message: "Database write failure." });
}

}); 

// 7. Live Endpoint 5: Activate Mining Contract Node Matrix
app.post('/api/invest', async (req, res) => {
const { phone, machineId, cost, dailyRate, period } = req.body;
try {
let user = await User.findOne({ phone: phone });
if (!user) return res.status(404).json({ success: false, message: "User not found" });
if (user.balance < cost) return res.status(400).json({ success: false, message: "Insufficient balance!" }); 

user.balance -= cost;
user.investments.push({ machineId, cost, dailyRate, period, daysEarned: 0, purchaseDate: new Date() });
user.transactions.push({ type: "Investment", amount: -cost, date: new Date(), details: `Activated Machine M${machineId}` });

await user.save();
res.json({ success: true, balance: user.balance, message: "Investment node activated successfully!" });

} catch (err) {
res.status(500).json({ success: false, message: "Investment pipeline failure." });
}

}); 

// 8. Live Endpoint 6: Initialize Cashout Payout Request
app.post('/api/withdraw', async (req, res) => {
const { phone, amount } = req.body;
const withdrawAmount = parseInt(amount); 

try {
let user = await User.findOne({ phone: phone });
if (!user) return res.status(404).json({ success: false, message: "User not found." });
if (withdrawAmount < 5000) return res.status(400).json({ success: false, message: "Minimum is 5,000 UGX." });
if (user.balance < withdrawAmount) return res.status(400).json({ success: false, message: "Insufficient balance." });
user.balance -= withdrawAmount;
const withdrawalId = 'WD-' + Math.random().toString(36).substr(2, 9).toUpperCase(); 
user.withdrawals.push({ id: withdrawalId, amount: withdrawAmount, status: "Pending Approval", requestedAt: new Date() });
user.transactions.push({ type: "Withdrawal Pending", amount: withdrawAmount, date: new Date(), txRef: withdrawalId, details: "Pending Cashout Review" });

await user.save();
res.json({ success: true, balance: user.balance, message: `Payout initialized! ${withdrawAmount.toLocaleString()} UGX is processing.` });

} catch (err) {
res.status(500).json({ success: false, message: "Cashout pipeline initialization error." });
}

}); 

// 9. Live Endpoint 7: Administrative Network Overview Metrics Aggregation
app.get('/api/admin/overview', async (req, res) => {
const clientPin = req.headers['x-admin-pin'];
if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" }); 

try {
const allUsers = await User.find({});
let totalInvestedVolume = 0;
let activeMachinesCount = 0;
let globalLedger = [];
allUsers.forEach(u => {
    u.investments.forEach(i => {
        totalInvestedVolume += i.cost;
        activeMachinesCount += 1;
    });
    u.transactions.forEach(t => {
        globalLedger.push({
            username: u.username,
            phone: u.phone,
            type: t.type,
            amount: t.amount,
            txRef: t.txRef || 'N/A',
            date: t.date
        });
    });
});

res.json({ success: true, allUsers, totalInvestedVolume, activeMachinesCount, globalLedger });

} catch (err) {
res.status(500).json({ success: false, message: "Admin stats collection failure." });
}

}); 

// 10. Live Endpoint 8: Resolve Deposits (Admin Action Handler)
app.post('/api/admin/resolve-deposit', async (req, res) => {
try {
const { phone, txRef, action } = req.body;
if (!phone || !txRef || !action) {
return res.status(400).json({ message: 'Missing required parameters' });
} 

const user = await User.findOne({ phone });
if (!user) return res.status(404).json({ message: 'User profile not found' });

const transaction = user.transactions.find(t => t.txRef === txRef && t.type === 'Deposit Pending');
if (!transaction) return res.status(404).json({ message: 'Pending deposit transaction not found' });

if (action === 'approve') {
    transaction.type = 'Deposit Approved';
    user.balance += Number(transaction.amount); 
} else if (action === 'reject') {
    transaction.type = 'Deposit Rejected';
} else {
    return res.status(400).json({ message: 'Invalid action request type' });
}

user.markModified('transactions');
await user.save();
return res.json({ message: `Transaction successfully ${action}ed!` });

    } catch (error) {
        return res.status(500).json({ message: 'Internal server ledger management fault' });
    }
});

// 11. Automated Background Yield Loop (Runs every 60 seconds)
setInterval(async () => {
    try {
        const users = await mongoose.model('User').find({});
        for (let user of users) {
            let userUpdated = false;
            if (user.investments && user.investments.length > 0) {
                user.investments.forEach(inv => {
                    user.balance += Number(inv.dailyRate || 0);
                    userUpdated = true;
                });
            }
            if (userUpdated) {
                await user.save();
            }
        }
    } catch (err) {
        console.error("Background passive contract calculation runtime fault:", err);
    }
}, 60000);

// START THE LIVE EXPORT EXPRESS SERVER ENGINE
const PORT_ENGINE = process.env.PORT || 3000;
app.listen(PORT_ENGINE, () => {
    console.log("Server running successfully!");
});

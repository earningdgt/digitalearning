const express = require('express');
const path = require('path');
const mongoose = require('mongoose'); // Swapped out 'fs' filesystem operations for MongoDB
const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET_PIN = "9999"; 

// 1. Establish the Live MongoDB Database Connection
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
    console.error("CRITICAL ERROR: MONGODB_URI environmental variable is missing inside Render dashboard!");
}

mongoose.connect(mongoURI)
    .then(() => console.log('Successfully connected to secure MongoDB Cluster!'))
    .catch(err => console.error('Database connection error:', err));

// 2. Define the Complete User Data Schema Model
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

// 1. Account Registration Module
app.post('/api/register', async (req, res) => {
    const { username, phone, password, referredBy } = req.body;
    if (!username || !phone || !password) return res.status(400).json({ success: false, message: "Missing required inputs" });

    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) return res.status(400).json({ success: false, message: "Account already exists." });

        let newUser = new User({ username, phone, password, referredBy: referredBy || null });

        if (referredBy) {
            let referrer = await User.findOne({ phone: referredBy });
            if (referrer) {
                referrer.referralCount += 1;
                referrer.balance += 1000;
                referrer.transactions.push({ type: "Referral Bonus", amount: 1000, date: new Date(), details: `Invited ${username}` });
                await referrer.save();
            }
        }

        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Secure Login Verification
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await User.findOne({ phone, password });
        if (!user) return res.status(401).json({ success: false, message: "Incorrect security credentials." });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Fetch Single Client Profile
app.get('/api/user/:phone', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.params.phone });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Manual Request Logging Matrix
app.post('/api/deposit', async (req, res) => {
    const { phone, amount, txId, details } = req.body;
    try {
        let user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ success: false, message: "User profile not found." });

        user.transactions.push({ type: "Deposit Pending", amount: parseInt(amount), date: new Date(), txRef: txId, details: details || `Tx ID: ${txId}` });
        await user.save();
        res.json({ success: true, message: "Manual request logged successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Activate Mining Contract
app.post('/api/invest', async (req, res) => {
    const { phone, machineId, cost, dailyRate, period } = req.body;
    try {
        let user = await User.findOne({ phone });
        if (!user || user.balance < cost) return res.status(400).json({ success: false, message: "Insufficient balance!" });

        user.balance -= cost;
        user.investments.push({ machineId, cost, dailyRate, period, daysEarned: 0, purchaseDate: new Date() });
        user.transactions.push({ type: "Investment", amount: -cost, date: new Date(), details: `Activated Machine M${machineId}` });
        await user.save();
        res.json({ success: true, balance: user.balance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Initialize Payout Request
app.post('/api/withdraw', async (req, res) => {
    const { phone, amount } = req.body;
    const withdrawAmount = parseInt(amount);
    try {
        let user = await User.findOne({ phone });
        if (!user || user.balance < withdrawAmount) return res.status(400).json({ success: false, message: "Insufficient balance." });

        user.balance -= withdrawAmount;
        const withdrawalId = 'WD-' + Math.random().toString(36).substr(2, 9).toUpperCase(); 
        user.withdrawals.push({ id: withdrawalId, amount: withdrawAmount, status: "Pending Approval", requestedAt: new Date() });
        user.transactions.push({ type: "Withdrawal Pending", amount: withdrawAmount, date: new Date(), txRef: withdrawalId, details: "Pending Cashout Review" });
        await user.save();
        res.json({ success: true, balance: user.balance, txRef: withdrawalId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7. Administrative Overview (Aligned perfectly with admin.html)
app.get('/api/admin/overview', async (req, res) => {
    if (req.headers['x-admin-pin'] !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });
    
    try {
        let users = await User.find({});
        let totalInvestedVolume = 0;
        let activeMachinesCount = 0;
        let globalledger = [];

        users.forEach(u => {
            if(u.investments) {
                u.investments.forEach(i => { totalInvestedVolume += i.cost; activeMachinesCount += 1; });
            }
            if(u.transactions) {
                u.transactions.forEach(t => { 
                    globalledger.push({ 
                        username: u.username, 
                        phone: u.phone, 
                        type: t.type, 
                        amount: t.amount, 
                        txRef: t.txRef || null, 
                        timestamp: t.date 
                    }); 
                });
            }
        });

        res.json({ 
            success: true, 
            totalUsers: users.length,
            totalInvestedVolume, 
            activeMachinesCount, 
            usersList: users, 
            globalledger 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8. Resolve Deposits & Transactions
app.post('/api/admin/resolve-transaction', async (req, res) => {
    if (req.headers['x-admin-pin'] !== ADMIN_SECRET_PIN) return res.status(403).json({ message: "Access Denied" });
    
    const { phone, txRef, action } = req.body;
    try {
        let user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ message: 'User not found' });

        let transaction = user.transactions.find(t => t.txRef === txRef && t.type === 'Deposit Pending');
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        if (action === 'approve') {
            transaction.type = 'Deposit Approved';
            user.balance += Number(transaction.amount); 
        } else {
            transaction.type = 'Deposit Rejected';
        }

        // Inform Mongoose that an item inside the array structure was manually mutated
        user.markModified('transactions');
        await user.save();
        return res.json({ message: `Transaction successfully completed!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 9. Tool Route: Modify Account Balance
app.post('/api/admin/adjust-balance', async (req, res) => {
    if (req.headers['x-admin-pin'] !== ADMIN_SECRET_PIN) return res.status(403).json({ message: "Access Denied" });
    
    const { phone, amount } = req.body;
    try {
        let user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ message: "User phone record missing." });

        user.balance += Number(amount);
        user.transactions.push({ type: "Admin Adjustment", amount: Number(amount), date: new Date(), details: "Balance changed by Administrator" });
        
        await user.save();
        res.json({ message: "User account balance adjusted successfully!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 10. Tool Route: Gift Free Hardware Contract
app.post('/api/admin/gift-contract', async (req, res) => {
    if (req.headers['x-admin-pin'] !== ADMIN_SECRET_PIN) return res.status(403).json({ message: "Access Denied" });
    
    const { phone, machineId } = req.body;
    try {
        let user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ message: "User profile not found." });

        let dailyRate = 3000;
        let title = "Eco Miner V1";
        if (machineId === "2") { dailyRate = 5000; title = "Cloud Core Server"; }
        if (machineId === "3") { dailyRate = 8000; title = "Supercomputing Cluster"; }

        user.investments.push({ machineId, cost: 0, dailyRate, period: 30, daysEarned: 0, purchaseDate: new Date() });
        user.transactions.push({ type: "Hardware Gift", amount: 0, date: new Date(), details: `Admin gifted ${title}` });
        
        await user.save();
        res.json({ message: "Contract gifted successfully!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(PORT, () => console.log(`Server listening live on port ${PORT}`));

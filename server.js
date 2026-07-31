const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET_PIN = "9999"; 
const DATA_FILE = path.join(__dirname, 'users.json');

// Helper functions to read/write local file storage
const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) { return []; }
};

const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Account Registration Module
app.post('/api/register', (req, res) => {
    const { username, phone, password, referredBy } = req.body;
    if (!username || !phone || !password) return res.status(400).json({ success: false, message: "Missing required inputs" });

    let users = readData();
    if (users.find(u => u.phone === phone)) return res.status(400).json({ success: false, message: "Account already exists." });

    let newUser = { username, phone, password, role: "user", balance: 0, referralCount: 0, referredBy: referredBy || null, investments: [], withdrawals: [], transactions: [] };

    if (referredBy) {
        let referrer = users.find(u => u.phone === referredBy);
        if (referrer) {
            referrer.referralCount += 1;
            referrer.balance += 1000;
            referrer.transactions.push({ type: "Referral Bonus", amount: 1000, date: new Date(), details: `Invited ${username}` });
        }
    }

    users.push(newUser);
    writeData(users);
    res.json({ success: true, user: newUser });
});

// 2. Secure Login Verification
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    let users = readData();
    const user = users.find(u => u.phone === phone && u.password === password);
    if (!user) return res.status(401).json({ success: false, message: "Incorrect security credentials." });
    res.json({ success: true, user });
});

// 3. Fetch Single Client Profile
app.get('/api/user/:phone', (req, res) => {
    let users = readData();
    const user = users.find(u => u.phone === req.params.phone);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
});

// 4. Manual Request Logging Matrix
app.post('/api/deposit', (req, res) => {
    const { phone, amount, txId, details } = req.body;
    let users = readData();
    let user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ success: false, message: "User profile not found." });

    user.transactions.push({ type: "Deposit Pending", amount: parseInt(amount), date: new Date(), txRef: txId, details: details || `Tx ID: ${txId}` });
    writeData(users);
    res.json({ success: true, message: "Manual request logged successfully!" });
});

// 5. Activate Mining Contract
app.post('/api/invest', (req, res) => {
    const { phone, machineId, cost, dailyRate, period } = req.body;
    let users = readData();
    let user = users.find(u => u.phone === phone);
    if (!user || user.balance < cost) return res.status(400).json({ success: false, message: "Insufficient balance!" });

    user.balance -= cost;
    user.investments.push({ machineId, cost, dailyRate, period, daysEarned: 0, purchaseDate: new Date() });
    user.transactions.push({ type: "Investment", amount: -cost, date: new Date(), details: `Activated Machine M${machineId}` });
    writeData(users);
    res.json({ success: true, balance: user.balance });
});

// 6. Initialize Payout Request
app.post('/api/withdraw', (req, res) => {
    const { phone, amount } = req.body;
    const withdrawAmount = parseInt(amount);
    let users = readData();
    let user = users.find(u => u.phone === phone);
    if (!user || user.balance < withdrawAmount) return res.status(400).json({ success: false, message: "Insufficient balance." });

    user.balance -= withdrawAmount;
    const withdrawalId = 'WD-' + Math.random().toString(36).substr(2, 9).toUpperCase(); 
    user.withdrawals.push({ id: withdrawalId, amount: withdrawAmount, status: "Pending Approval", requestedAt: new Date() });
    user.transactions.push({ type: "Withdrawal Pending", amount: withdrawAmount, date: new Date(), txRef: withdrawalId, details: "Pending Cashout Review" });
    writeData(users);
    res.json({ success: true, balance: user.balance, txRef: withdrawalId });
});

// 7. Administrative Overview
app.get('/api/admin/overview', (req, res) => {
    if (req.headers['x-admin-pin'] !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });
    let users = readData();
    let totalInvestedVolume = 0;
    let activeMachinesCount = 0;
    let globalLedger = [];

    users.forEach(u => {
        u.investments.forEach(i => { totalInvestedVolume += i.cost; activeMachinesCount += 1; });
        u.transactions.forEach(t => { globalLedger.push({ username: u.username, phone: u.phone, type: t.type, amount: t.amount, txRef: t.txRef || 'N/A', date: t.date }); });
    });
    res.json({ success: true, allUsers: users, totalInvestedVolume, activeMachinesCount, globalLedger });
});

// 8. Resolve Deposits
app.post('/api/admin/resolve-deposit', (req, res) => {
    const { phone, txRef, action } = req.body;
    let users = readData();
    let user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let transaction = user.transactions.find(t => t.txRef === txRef && t.type === 'Deposit Pending');
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (action === 'approve') {
        transaction.type = 'Deposit Approved';
        user.balance += Number(transaction.amount); 
    } else {
        transaction.type = 'Deposit Rejected';
    }

    writeData(users);
    return res.json({ message: `Transaction successfully ${action}ed!` });
});

// 9. Automated Yield Loop (Every 60 seconds)
setInterval(() => {
    let users = readData();
    let updated = false;
    users.forEach(user => {
        if (user.investments && user.investments.length > 0) {
            user.investments.forEach(inv => { user.balance += Number(inv.dailyRate || 0); updated = true; });
        }
    });
    if (updated) writeData(users);
}, 60000);

// START EXPORT SERVER ENGINE
app.listen(PORT, () => { console.log("Server running successfully!"); });

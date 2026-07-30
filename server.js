const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;


const DB_FILE = path.join(__dirname, 'users.json');
const ADMIN_SECRET_PIN = "9999"; 

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) return [];
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error("Database reading error:", error);
        return [];
    }
}

function writeDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 1. Account Registration Endpoint
app.post('/api/register', (req, res) => {
    const { username, phone, password, referredBy } = req.body;
    if (!username || !phone || !password) {
        return res.status(400).json({ success: false, message: "Missing required inputs" });
    }

    let database = readDatabase();
    let user = database.find(u => u.phone === phone);
    
    if (user) {
        return res.status(400).json({ success: false, message: "An account with this phone number already exists." });
    }

    user = {
        username: username,
        phone: phone,
        password: password,
        balance: 0,
        investments: [],
        withdrawals: [],
        transactions: [],
        referredBy: referredBy || null,
        referralCount: 0
    };
    
    if (referredBy) {
        let referrer = database.find(u => u.phone === referredBy);
        if (referrer) {
            referrer.referralCount = (referrer.referralCount || 0) + 1;
            referrer.balance += 1000; 
            if (!referrer.transactions) referrer.transactions = [];
            referrer.transactions.push({
                type: "Referral Bonus",
                amount: 1000,
                date: new Date(),
                details: `Invited ${username}`
            });
        }
    }

    database.push(user);
    writeDatabase(database);
    res.json({ success: true, user: user });
});

// 2. Account Secure Login Verification
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ success: false, message: "Missing inputs" });
    }

    const database = readDatabase();
    const user = database.find(u => u.phone === phone);

    if (!user) {
        return res.status(404).json({ success: false, message: "No account identified with this phone number." });
    }

    if (user.password !== password) {
        return res.status(401).json({ success: false, message: "Incorrect security password credentials." });
    }

    res.json({ success: true, user });
});

// 3. Fetch Single Profile Route
app.get('/api/user/:phone', (req, res) => {
    const database = readDatabase();
    const user = database.find(u => u.phone === req.params.phone);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
});

// 4. Manual Deposit Request Input Logging
app.post('/api/deposit', (req, res) => {
    const { phone, amount, txId } = req.body;
    if (!phone || !amount || !txId) {
        return res.status(400).json({ success: false, message: "Missing verification payload inputs." });
    }

    let database = readDatabase();
    let user = database.find(u => u.phone === phone);

    if (!user) return res.status(404).json({ success: false, message: "User profile not found." });

    const cleanAmount = parseInt(amount);

    if (!user.transactions) user.transactions = [];
    user.transactions.push({
        type: "Deposit Pending",
        amount: cleanAmount,
        date: new Date(),
        txRef: txId,
        details: `Tx ID: ${txId} - Awaiting Fahad's Verification`
    });

    writeDatabase(database);
    res.json({ success: true, message: "Manual request logged successfully!" });
});

// 5. Investment Purchase Endpoint
app.post('/api/invest', (req, res) => {
    const { phone, machineId, cost, dailyRate, period } = req.body;
    let database = readDatabase();
    let user = database.find(u => u.phone === phone);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.balance < cost) return res.status(400).json({ success: false, message: "Insufficient balance!" });

    user.balance -= cost;
    user.investments.push({ machineId, cost, dailyRate, period, daysEarned: 0, purchaseDate: new Date() });

    if (!user.transactions) user.transactions = [];
    user.transactions.push({ type: "Investment", amount: -cost, date: new Date(), details: `Activated Machine M${machineId}` });

    writeDatabase(database);
    res.json({ success: true, balance: user.balance, message: "Investment activated successfully!" });
});

// 6. Automated Payout Withdrawal Request
app.post('/api/withdraw', (req, res) => {
    const { phone, amount } = req.body;
    const withdrawAmount = parseInt(amount);

    if (!phone || !withdrawAmount) return res.status(400).json({ success: false, message: "Invalid parameters." });
    let database = readDatabase();
    let user = database.find(u => u.phone === phone);

    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (withdrawAmount < 5000) return res.status(400).json({ success: false, message: "Minimum is 5,000 UGX." });
    if (user.balance < withdrawAmount) return res.status(400).json({ success: false, message: "Insufficient balance." });

    user.balance -= withdrawAmount;
    if (!user.withdrawals) user.withdrawals = [];
    const withdrawalId = Date.now().toString(); 
    user.withdrawals.push({ id: withdrawalId, amount: withdrawAmount, status: "Pending Approval", requestedAt: new Date() });

    if (!user.transactions) user.transactions = [];
    user.transactions.push({ type: "Withdrawal", amount: -withdrawAmount, date: new Date(), details: "Pending Cashout Review", withdrawalId: withdrawalId });

    writeDatabase(database);
    res.json({ success: true, balance: user.balance, message: `Payout initialization logged! ${withdrawAmount.toLocaleString()} UGX is processing.` });
});

// ADVANCED ADMIN FUNCTION 1: Force Adjust Account Balance Directly
app.post('/api/admin/adjust-balance', (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, amount } = req.body;
    let database = readDatabase();
    let user = database.find(u => u.phone === phone);

    if (!user) return res.status(404).json({ success: false, message: "User account profile not identified" });

    const adjustValue = parseInt(amount);
    user.balance += adjustValue;

    if (!user.transactions) user.transactions = [];
    user.transactions.push({
        type: "Admin Adjustment",
        amount: adjustValue,
        date: new Date(),
        details: `Balance altered manually by Fahad`
    });

    writeDatabase(database);
    res.json({ success: true, message: `Successfully adjusted balance by ${adjustValue.toLocaleString()} UGX!` });
});

// ADVANCED ADMIN FUNCTION 2: Gift Active Machine to User without Cost
app.post('/api/admin/gift-machine', (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, machineId, name, dailyRate, period } = req.body;
    let database = readDatabase();
    let user = database.find(u => u.phone === phone);

    if (!user) return res.status(404).json({ success: false, message: "User account profile not identified" });

    user.investments.push({
        machineId: parseInt(machineId),
        cost: 0, // Gifted for free
        dailyRate: parseInt(dailyRate),
        period: parseInt(period),
        daysEarned: 0,
        purchaseDate: new Date()
    });

    if (!user.transactions) user.transactions = [];
    user.transactions.push({
        type: "Admin Gift",
        amount: 0,
        date: new Date(),
        details: `Free ${name} hardware gifted by Admin`
    });

    writeDatabase(database);
    res.json({ success: true, message: `Successfully gifted ${name} to ${user.username}!` });
});

// 7. Admin Action Endpoint (Process Approval or Rejections for Logs Queue)
app.post('/api/admin/withdraw/action', (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, withdrawalId, statusAction, type } = req.body; 
    let database = readDatabase();
    let user = database.find(u => u.phone === phone);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (type === 'deposit') {
        let transaction = user.transactions.find(t => t.txRef === withdrawalId && t.type === "Deposit Pending");
        if (!transaction) return res.status(404).json({ success: false, message: "Pending deposit item not identified" });

        if (statusAction === "Approved") {
            user.balance += transaction.amount;
            transaction.type = "Deposit";
            transaction.details = `Approved by Admin (Ref: ${withdrawalId})`;
        } else {
            transaction.type = "Deposit Rejected";
            transaction.details = `Rejected by Admin (Ref: ${withdrawalId})`;
        }
        writeDatabase(database);
        return res.json({ success: true, message: `Deposit request marked as ${statusAction}!` });
    }

       let withdrawal = user.withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal log item not found" });

    if (statusAction === "Approved") {
        withdrawal.status = "Approved";
        let transaction = user.transactions.find(t => t.withdrawalId === withdrawalId);
        if (transaction) transaction.details = "Payout Approved & Dispatched via Mobile Money";
    } else if (statusAction === "Rejected") {
        withdrawal.status = "Rejected";
        user.balance += withdrawal.amount;
        let transaction = user.transactions.find(t => t.withdrawalId === withdrawalId);
        if (transaction) transaction.details = "Payout Rejected (Funds Refunded)";
        user.transactions.push({ type: "Refund", amount: withdrawal.amount, date: new Date(), details: `Refund for Rejected Withdrawal ID: ${withdrawalId}` });
    }

    writeDatabase(database);
    res.json({ success: true, message: `Withdrawal marked as ${statusAction}!` });
});

// 8. Protected Admin Overview Dashboard Aggregator Endpoint
app.get('/api/admin/overview', (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const database = readDatabase();
    let totalDepositsCalculated = 0;
    let activeHardwareUnitsCount = 0;
    let masterLedgerList = [];
    let pendingCashoutsList = [];

    database.forEach(u => {
        if (u.investments) {
            activeHardwareUnitsCount += u.investments.length;
            u.investments.forEach(i => { totalDepositsCalculated += i.cost; });
        }
        if (u.withdrawals) {
            u.withdrawals.forEach(w => {
                if (w.status === "Pending Approval") { pendingCashoutsList.push({ id: w.id, username: u.username, phone: u.phone, amount: w.amount, date: w.requestedAt, type: 'withdrawal' }); }
            });
        }
        if (u.transactions) {
            u.transactions.forEach(t => {
                masterLedgerList.push({ username: u.username, phone: u.phone, type: t.type, amount: t.amount, date: t.date, details: t.details });
                if (t.type === "Deposit Pending") {
                    pendingCashoutsList.push({ id: t.txRef, username: u.username, phone: u.phone, amount: t.amount, date: t.date, type: 'deposit' });
                }
            });
        }
    });

    masterLedgerList.sort((a, b) => new Date(b.date) - new Date(a.date));
    pendingCashoutsList.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, totalUsers: database.length, totalInvestedVolume: totalDepositsCalculated, activeMachinesCount: activeHardwareUnitsCount, usersList: database, globalLedger: masterLedgerList, pendingCashouts: pendingCashoutsList });
});

// Income Distribution Loop (Every 60 seconds)
setInterval(() => {
    let database = readDatabase();
    let updated = false;

    database.forEach(user => {
        if (user.investments && user.investments.length > 0) {
            user.investments.forEach(inv => {
                if (inv.daysEarned < inv.period) {
                    user.balance += inv.dailyRate;
                    inv.daysEarned += 1;
                    updated = true;
                    if (!user.transactions) user.transactions = [];
                    user.transactions.push({ type: "Earnings", amount: inv.dailyRate, date: new Date(), details: `Mining Income` });
                }
            });
        }
    });
    if (updated) writeDatabase(database);
}, 60000); 

app.listen(PORT, () => { console.log(`Server is running live at http://localhost:${PORT}`); });

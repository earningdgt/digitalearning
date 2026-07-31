const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET_PIN = "9999"; 

// 1. Establish Secure Connection to Cloud Database Engine
// The server will look for your secret link inside Railway environment variables
const MONGO_URI = process.env.MONGO_URI || "PASTE_YOUR_MONGODB_CONNECTION_STRING_HERE";

mongoose.connect(MONGO_URI)
    .then(() => console.log("Database connected successfully! Ready for permanent tracking..."))
    .catch(err => console.error("Database initialization fault:", err));

// 2. Define Permanent User Data Model Schema (Passwords Saved Plain-Text as Requested)
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
        const withdrawalId = Date.now().toString(); 
        user.withdrawals.push({ id: withdrawalId, amount: withdrawAmount, status: "Pending Approval", requestedAt: new Date() });
        user.transactions.push({ type: "Withdrawal", amount: -withdrawAmount, date: new Date(), details: "Pending Cashout Review", withdrawalId: withdrawalId });

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
                    details: t.details,
                    date: t.date,
                    txRef: t.txRef,
                    withdrawalId: t.withdrawalId
                });
            });
        });

        globalLedger.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            totalUsers: allUsers.length,
            totalInvestedVolume,
            activeMachinesCount,
            usersList: allUsers,
            globalLedger: globalLedger.slice(0, 50)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error compiling admin records system parameters." });
    }
});

// 10. Live Endpoint 8: Direct Administrative Capital Shifting Matrix Override
app.post('/api/admin/adjust-balance', async (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, amount } = req.body;
    try {
        let user = await User.findOne({ phone: phone });
        if (!user) return res.status(404).json({ success: false, message: "User account profile not identified" });

        const adjustValue = parseInt(amount);
        user.balance += adjustValue;
        user.transactions.push({
            type: "Admin Adjustment",
            amount: adjustValue,
            date: new Date(),
            details: `Balance altered manually by Administrator override`
        });

        await user.save();
        res.json({ success: true, message: `Successfully adjusted balance by ${adjustValue.toLocaleString()} UGX!` });
    } catch (err) {
// 11. Live Endpoint 9: Inject Free Hardware Node Matrix Asset
app.post('/api/admin/gift-machine', async (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, machineId, dailyRate, period } = req.body;
    try {
        let user = await User.findOne({ phone: phone });
        if (!user) return res.status(404).json({ success: false, message: "User account profile not identified" });

        user.investments.push({
            machineId: parseInt(machineId),
            cost: 0, 
            dailyRate: parseInt(dailyRate),
            period: parseInt(period),
            daysEarned: 0,
            purchaseDate: new Date()
        });

        user.transactions.push({
            type: "Admin Gift",
            amount: 0,
            date: new Date(),
            details: `Complimentary Node Level ${machineId} deployed by Admin override`
        });

        await user.save();
        res.json({ success: true, message: `Successfully gifted Computing Node Layer Level ${machineId} to target profile!` });
    } catch (err) {
        res.status(500).json({ success: false, message: "Gifting routine node asset transmission error." });
    }
});

// 12. Live Endpoint 10: Process Pending Verification Deposits Actions
app.post('/api/admin/verify-deposit', async (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, txRef, action } = req.body;
    try {
        let user = await User.findOne({ phone: phone });
        if (!user) return res.status(404).json({ success: false, message: "User account profile not identified" });

        let transaction = user.transactions.find(t => t.txRef === txRef && t.type === "Deposit Pending");
        if (!transaction) return res.status(404).json({ success: false, message: "Pending deposit transaction not found" });

        if (action === 'approve') {
            transaction.type = "Deposit Approved";
            transaction.details = `Tx ID: ${txRef} - Verified by Admin`;
            user.balance += transaction.amount;
            res.json({ success: true, message: `Deposit of ${transaction.amount.toLocaleString()} UGX approved successfully!` });
        } else {
            transaction.type = "Deposit Rejected";
            transaction.details = `Tx ID: ${txRef} - Rejected by Admin`;
            res.json({ success: true, message: "Deposit request rejected." });
        }

        user.markModified('transactions');
        await user.save();
    } catch (err) {
        res.status(500).json({ success: false, message: "Deposit verification processing fault error." });
    }
});

// 13. Live Endpoint 11: Process Pending Withdrawal Payout Verification Actions
app.post('/api/admin/verify-withdrawal', async (req, res) => {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_SECRET_PIN) return res.status(403).json({ success: false, message: "Access Denied" });

    const { phone, withdrawalId, action } = req.body;
    try {
        let user = await User.findOne({ phone: phone });
        if (!user) return res.status(404).json({ success: false, message: "User account profile not identified" });

        let withdrawal = user.withdrawals.find(w => w.id === withdrawalId);
        let transaction = user.transactions.find(t => t.withdrawalId === withdrawalId);

        if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal record not found" });

        if (action === 'approve') {
            withdrawal.status = "Approved & Disbursed";
            if (transaction) {
                transaction.type = "Withdrawal Success";
                transaction.details = "Cashout Approved and Processed";
            }
            res.json({ success: true, message: "Withdrawal payout approved successfully!" });
        } else {
            withdrawal.status = "Rejected / Cancelled";
            if (transaction) {
                transaction.type = "Withdrawal Rejected";
                transaction.details = "Cashout request denied. Funds refunded.";
            }
            user.balance += withdrawal.amount;
            res.json({ success: true, message: "Withdrawal rejected. Funds refunded to user balance." });
        }

        user.markModified('withdrawals');
        user.markModified('transactions');
        await user.save();
    } catch (err) {
        res.status(500).json({ success: false, message: "Withdrawal verification processing fault error." });
    }
});

// 14. Automated Background Interval: Yield Accumulation Cycle (Runs every 60 seconds)
setInterval(async () => {
    try {
        const users = await User.find({});
        for (let user of users) {
            if (user.investments && user.investments.length > 0) {
                let earnedToday = 0;
                user.investments.forEach(m => {
                    if (m.daysEarned < m.period) {
                        m.daysEarned += 1;
                        earnedToday += m.dailyRate;
                    }
                });
                if (earnedToday > 0) {
                    user.balance += earnedToday;
                    user.transactions.push({
                        type: "Mining Yield",
                        amount: earnedToday,
                        date: new Date(),
                        details: `Accrued passive computing yields from active nodes matrix clusters`
                    });
                    user.markModified('investments');
                    await user.save();
                }
            }
        }
    } catch (err) {
        console.error("Automated background accrual error execution fault loop:", err);
    }
}, 60000);

app.listen(PORT, () => console.log(`Server engine actively parsing network request operations on port channel connection: ${PORT}`));

// POST route to handle admin approval or rejection of deposits
app.post('/api/admin/resolve-deposit', async (req, res) => {
    try {
        const { phone, txRef, action } = req.body;

        if (!phone || !txRef || !action) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Find the user profile in MongoDB Atlas
        const user = await mongoose.model('User').findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        // Locate the specific transaction within the user's matrix log array
        const transaction = user.transactions.find(t => t.txRef === txRef && t.type === 'Deposit Pending');
        if (!transaction) {
            return res.status(404).json({ message: 'Pending transaction matching reference not found' });
        }

        // Execute updates based on action type
        if (action === 'approve') {
            transaction.type = 'Deposit Approved';
            user.balance += Number(transaction.amount); 
        } else if (action === 'reject') {
            transaction.type = 'Deposit Rejected';
        } else {
            return res.status(400).json({ message: 'Invalid administrative action request type' });
        }

        user.markModified('transactions');
        await user.save();

                        return res.json({ message: `Transaction successfully ${action}ed and profile updated` });

    } catch (error) {
        console.error('Admin resolution operational failure:', error);
        return res.status(500).json({ message: 'Internal server ledger management routing fault' });
    }
});
        // POST route to initialize a user withdrawal transaction request
app.post('/api/user/withdraw', async (req, res) => {
    try {
        const { phone, amount } = req.body;

        // 1. Basic format and numeric validation
        if (!phone || !amount || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid mobile money withdrawal parameters' });
        }

        // 2. Locate user status inside MongoDB Atlas
        const user = await mongoose.model('User').findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'Target user profile not found' });
        }

        // 3. Prevent balance overdrafts before logging the ledger entry
        if (user.balance < Number(amount)) {
            return res.status(400).json({ message: 'Insufficient active contract account balance' });
        }

        // 4. Generate a unique transaction tracking reference ID
        const txRef = 'WD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        // 5. Deduct money immediately and append a pending log item
        user.balance -= Number(amount);
        user.transactions.push({
            type: 'Withdrawal Pending',
            amount: Number(amount),
            txRef: txRef,
            date: new Date()
        });

        await user.save();
                               return res.json({ message: 'Withdrawal initialized successfully', txRef });

    } catch (error) {
        console.error('Withdrawal processing failure:', error);
        return res.status(500).json({ message: 'Internal server account withdrawal fault' });
    }
});


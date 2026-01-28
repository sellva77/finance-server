const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndex() {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!uri) {
            console.log('❌ No MongoDB URI found in environment');
            process.exit(1);
        }
        
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');
        
        // Try to drop the old unique compound index
        try {
            await mongoose.connection.db.collection('accounts').dropIndex('userId_1_accountType_1');
            console.log('✅ Old index dropped successfully!');
        } catch (e) {
            console.log('ℹ️ Index may not exist or already dropped:', e.message);
        }
        
        await mongoose.disconnect();
        console.log('✅ Done!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

dropIndex();

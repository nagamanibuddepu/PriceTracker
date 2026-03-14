const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = 'mongodb://localhost:27017/price-compare';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Successfully connected to MongoDB.');
    
    // Test database operations
    const db = client.db('price-compare');
    
    // Test users collection
    const users = db.collection('users');
    const userCount = await users.countDocuments();
    console.log(`Number of users in database: ${userCount}`);
    
    // Test sessions collection
    const sessions = db.collection('sessions');
    const sessionCount = await sessions.countDocuments();
    console.log(`Number of sessions in database: ${sessionCount}`);

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  } finally {
    await client.close();
  }
}

testConnection(); 
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkUsers() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  console.log('Using MongoDB URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('pricetracker');
    const users = db.collection('users');
    const sessions = db.collection('sessions');

    // Get all users
    const allUsers = await users.find({}).toArray();
    console.log('\nAll users in database:');
    allUsers.forEach(user => {
      console.log({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        hasPassword: !!user.password
      });
    });

    // Get all sessions
    const allSessions = await sessions.find({}).toArray();
    console.log('\nAll sessions in database:');
    allSessions.forEach(session => {
      console.log({
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkUsers(); 
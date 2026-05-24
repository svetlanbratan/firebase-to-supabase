const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const dbConfig = JSON.parse(fs.readFileSync('supabase-service.json', 'utf8'));
  
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });

  await client.connect();
  console.log('Подключено к Supabase!');

  const rawData = fs.readFileSync('triad-scoring-system-default-rtdb-export.json', 'utf8');
  const data = JSON.parse(rawData);

  for (const [collectionName, collectionData] of Object.entries(data)) {
    if (!collectionData) continue;

    // Вот здесь мы добавили спасительную приставку rtdb_
    const tableName = 'rtdb_' + collectionName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    console.log(`\nСоздаю таблицу: ${tableName}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        data JSONB
      );
    `);

    console.log(`Загружаю данные в ${tableName}...`);
    let count = 0;
    
    for (const [key, value] of Object.entries(collectionData)) {
      if (value === null) continue;
      
      const recordId = value.id || key; 
      
      const query = `
        INSERT INTO ${tableName} (id, data) 
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
      `;
      await client.query(query, [String(recordId), JSON.stringify(value)]);
      count++;
    }
    console.log(`✅ Загружено записей: ${count}`);
  }

  console.log('\n🎉 Миграция Realtime Database успешно завершена!');
  await client.end();
}

run().catch(err => console.error('Ошибка:', err));
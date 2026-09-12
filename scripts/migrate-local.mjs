import { readdirSync,readFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
if(!existsSync(dir))throw new Error('Démarrez le serveur une première fois pour créer la base D1 locale.');
const files=readdirSync(dir).filter(n=>n.endsWith('.sqlite')&&!n.includes('metadata'));
if(files.length!==1)throw new Error('La base locale est ambiguë ; indiquez le bon projet et arrêtez les autres serveurs.');
const db=new DatabaseSync(join(dir,files[0]));db.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS __novelys_local_migrations(name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){if(db.prepare('SELECT name FROM __novelys_local_migrations WHERE name=?').get(name))continue;db.exec('BEGIN IMMEDIATE');try{for(const part of readFileSync(join('drizzle',name),'utf8').split('--> statement-breakpoint'))if(part.trim())db.exec(part);db.prepare('INSERT INTO __novelys_local_migrations VALUES(?,?)').run(name,Date.now());db.exec('COMMIT');console.log('Migration locale appliquée : '+name);}catch(e){db.exec('ROLLBACK');throw e;}}
db.close();

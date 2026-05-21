import { loadInputFiles } from '../lib/parser/parseInputFiles';
import path from 'node:path';

async function main() {
  const filePath = "/Users/maekawahiroyuki/Downloads/さいたま市大宮区でおすすめの美味しいカフェ・喫茶店をご紹介！___食べログ_20260521_2131.csv";
  const records = await loadInputFiles([filePath]);
  console.log("Total loaded records:", records.length);
  console.log("First record keys & values:");
  console.log(JSON.stringify(records[0], null, 2));
}

main().catch(console.error);

import fs from 'fs';
import path from 'path';
import { Client } from '@notionhq/client';

// .dev.vars の簡易パーサー
function loadDevVars(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.dev.vars');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .dev.vars ファイルが見つかりません。');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const vars: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[match[1]] = value;
    }
  }
  return vars;
}

async function testNotion() {
  console.log('🔍 .dev.vars を読み込んでいます...');
  const env = loadDevVars();

  const apiKey = env.NOTION_API_KEY;
  const postsDbId = env.NOTION_POSTS_DATABASE_ID;
  const tagsDbId = env.NOTION_TAGS_DATABASE_ID;

  if (!apiKey || !postsDbId || !tagsDbId) {
    console.error('❌ 必要な環境変数が不足しています:');
    if (!apiKey) console.error('  - NOTION_API_KEY が未設定です');
    if (!postsDbId) console.error('  - NOTION_POSTS_DATABASE_ID が未設定です');
    if (!tagsDbId) console.error('  - NOTION_TAGS_DATABASE_ID が未設定です');
    process.exit(1);
  }

  console.log('🔑 APIキー形式確認:', apiKey.startsWith('ntn_') || apiKey.startsWith('secret_') ? 'OK (有効なプレフィックス)' : '⚠️ プレフィックスに注意');

  const notion = new Client({ auth: apiKey });

  // 1. タグ管理データベースのテスト
  console.log('\n--- 1. タグ管理データベース (Tags DB) の接続テスト ---');
  try {
    const tagsDb = await notion.databases.retrieve({ database_id: tagsDbId });
    console.log('✅ タグ管理DBの取得成功:', (tagsDb as any).title?.[0]?.plain_text || '名称未設定');
    
    const tagsQuery = await notion.databases.query({
      database_id: tagsDbId,
      page_size: 10,
    });
    console.log(`✅ タグ取得成功 (取得件数: ${tagsQuery.results.length}件):`);
    tagsQuery.results.forEach((page: any, index) => {
      const titleKey = Object.keys(page.properties).find((k) => page.properties[k].type === 'title');
      const name = titleKey ? page.properties[titleKey]?.title?.[0]?.plain_text : '未設定';
      console.log(`   [${index + 1}] ID: ${page.id.slice(0, 8)}... | 名前: ${name}`);
    });
  } catch (error: any) {
    console.error('❌ タグ管理DBへのアクセス失敗:', error.message);
    if (error.code === 'object_not_found') {
      console.error('   👉 原因: Database IDが誤っているか、該当DBにインテグレーションの「コネクトの追加」が行われていません。');
    }
  }

  // 2. Posts データベースのテスト
  console.log('\n--- 2. Posts データベースの接続テスト ---');
  try {
    const postsDb = await notion.databases.retrieve({ database_id: postsDbId });
    console.log('✅ Posts DBの取得成功:', (postsDb as any).title?.[0]?.plain_text || '名称未設定');
    console.log('📋 検出されたプロパティ一覧:');
    for (const [key, val] of Object.entries((postsDb as any).properties)) {
      console.log(`   - ${key} (${(val as any).type})`);
    }

    const postsQuery = await notion.databases.query({
      database_id: postsDbId,
      page_size: 5,
    });
    console.log(`✅ 投稿一覧の取得成功 (既存投稿: ${postsQuery.results.length}件)`);
  } catch (error: any) {
    console.error('❌ Posts DBへのアクセス失敗:', error.message);
    if (error.code === 'object_not_found') {
      console.error('   👉 原因: Database IDが誤っているか、該当DBにインテグレーションの「コネクトの追加」が行われていません。');
    }
  }

  console.log('\n===========================================');
  console.log('🎉 テスト完了');
}

testNotion().catch((err) => {
  console.error('予期せぬエラー:', err);
});

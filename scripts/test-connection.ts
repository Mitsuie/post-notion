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

  if (!apiKey || !postsDbId) {
    console.error('❌ 必要な環境変数が不足しています:');
    if (!apiKey) console.error('  - NOTION_API_KEY が未設定です');
    if (!postsDbId) console.error('  - NOTION_POSTS_DATABASE_ID が未設定です');
    process.exit(1);
  }

  console.log('🔑 APIキー形式確認:', apiKey.startsWith('ntn_') || apiKey.startsWith('secret_') ? 'OK (有効なプレフィックス)' : '⚠️ プレフィックスに注意');

  const notion = new Client({ auth: apiKey });

  // 1. タグ管理データベースのテスト (任意)
  console.log('\n--- 1. タグ管理データベース (Tags DB) の接続テスト ---');
  if (!tagsDbId) {
    console.log('⚠️ NOTION_TAGS_DATABASE_ID が未設定です（タグ機能は無効となります）。');
  } else {
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

  // 3. 日報データベース (DB_日報) のテスト
  console.log('\n--- 3. 日報データベース (DB_日報) の接続テスト ---');
  const dailyDbId = env.NOTION_DAILY_REPORT_DATABASE_ID;
  if (!dailyDbId) {
    console.log('⚠️ NOTION_DAILY_REPORT_DATABASE_ID が未設定です。');
  } else {
    try {
      const dailyDb = await notion.databases.retrieve({ database_id: dailyDbId });
      console.log('✅ 日報DBの取得成功:', (dailyDb as any).title?.[0]?.plain_text || '名称未設定');
      console.log('📋 検出されたプロパティ一覧:');
      for (const [key, val] of Object.entries((dailyDb as any).properties)) {
        console.log(`   - ${key} (${(val as any).type})`);
      }

      // 本日の日付（JST: YYYY-MM-DD）で日報ページを検索
      const todayStr = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()).replace(/\//g, '-');

      console.log(`🔍 本日の日付 (${todayStr}) の日報ページを検索中...`);
      const dailyQuery = await notion.databases.query({
        database_id: dailyDbId,
        filter: {
          property: '日付',
          date: {
            equals: todayStr,
          },
        },
      });

      if (dailyQuery.results.length > 0) {
        const page: any = dailyQuery.results[0];
        const titleKey = Object.keys(page.properties).find((k) => page.properties[k].type === 'title');
        const title = titleKey ? page.properties[titleKey]?.title?.map((t: any) => t.plain_text).join('') : '未設定';
        console.log(`✅ 本日の日報ページを検出: ID=${page.id.slice(0, 8)}... | タイトル: "${title}"`);
      } else {
        console.log(`ℹ️ 本日の日報ページは見つかりませんでした（スキップ対象となります）`);
      }
    } catch (error: any) {
      console.error('❌ 日報DBへのアクセス失敗:', error.message);
      if (error.code === 'object_not_found') {
        console.error('   👉 原因: Database IDが誤っているか、該当DBにインテグレーションの「コネクトの追加」が行われていません。');
      }
    }
  }

  console.log('\n===========================================');
  console.log('🎉 テスト完了');
}

testNotion().catch((err) => {
  console.error('予期せぬエラー:', err);
});

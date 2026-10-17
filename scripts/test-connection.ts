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

// データベース ID からタイトル・先頭のデータソース・プロパティ定義を取得する（Notion API 2025-09-03 以降）
async function inspectDatabase(notion: Client, databaseId: string) {
  const db: any = await notion.databases.retrieve({ database_id: databaseId });
  const sources: Array<{ id: string; name?: string }> = db.data_sources ?? [];
  if (sources.length === 0) throw new Error('データソースが見つかりません');
  if (sources.length > 1) console.log(`⚠️ データソースが ${sources.length} 件あります。先頭（${sources[0].name ?? sources[0].id}）を使用します。`);
  const dataSource: any = await notion.dataSources.retrieve({ data_source_id: sources[0].id });
  return {
    title: db.title?.[0]?.plain_text || '名称未設定',
    dataSourceId: sources[0].id,
    properties: (dataSource.properties ?? {}) as Record<string, any>,
  };
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
      const tagsDb = await inspectDatabase(notion, tagsDbId);
      console.log('✅ タグ管理DBの取得成功:', tagsDb.title);

      const tagsQuery = await notion.dataSources.query({
        data_source_id: tagsDb.dataSourceId,
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
    const postsDb = await inspectDatabase(notion, postsDbId);
    console.log('✅ Posts DBの取得成功:', postsDb.title);
    console.log('📋 検出されたプロパティ一覧:');
    for (const [key, val] of Object.entries(postsDb.properties)) {
      console.log(`   - ${key} (${(val as any).type})`);
    }

    const postsQuery = await notion.dataSources.query({
      data_source_id: postsDb.dataSourceId,
      page_size: 5,
    });
    console.log(`✅ 投稿一覧の取得成功 (既存投稿: ${postsQuery.results.length}件)`);
  } catch (error: any) {
    console.error('❌ Posts DBへのアクセス失敗:', error.message);
    if (error.code === 'object_not_found') {
      console.error('   👉 原因: Database IDが誤っているか、該当DBにインテグレーションの「コネクトの追加」が行われていません。');
    }
  }

  // 3. 日報データベース (DB_日報) のテスト (任意)
  console.log('\n--- 3. 日報データベース (DB_日報) の接続テスト (任意) ---');
  const dailyDbId = env.NOTION_DAILY_REPORT_DATABASE_ID;
  if (!dailyDbId) {
    console.log('⚠️ NOTION_DAILY_REPORT_DATABASE_ID が未設定です（日報連携機能は無効となります）。');
  } else {
    try {
      const dailyDb = await inspectDatabase(notion, dailyDbId);
      console.log('✅ 日報DBの取得成功:', dailyDb.title);
      console.log('📋 検出されたプロパティ一覧:');
      for (const [key, val] of Object.entries(dailyDb.properties)) {
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
      const dailyQuery = await notion.dataSources.query({
        data_source_id: dailyDb.dataSourceId,
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

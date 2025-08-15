import dotenv from 'dotenv'
dotenv.config()

async function main() {
  console.log('Seeding categories...')

  // 动态导入，在 dotenv.config() 之后执行
  const { db } = await import('@/db')
  const { categories } = await import('@/db/schema')

  const categoryNames = [
    // 娱乐内容
    '电影',
    '电视剧',
    '综艺',
    '动漫',
    '音乐',
    '舞蹈',
    '搞笑',
    // 生活方式
    '美食',
    '旅行',
    '时尚',
    '美妆',
    '健身',
    '宠物',
    'Vlog',
    // 知识教育
    '教育',
    '科普',
    '历史',
    '文化',

    // 科技数码
    '科技',
    '数码',
    '汽车',

    // 体育游戏
    '体育',
    '游戏',
    '电竞',

    // 其他
    '新闻',
    '艺术',
    '生活记录',
    '摄影',
    '手工',
    '烹饪',
    '读书',
    '财经',
    '医疗健康',
    '育儿',
    '情感',
    '测评',
    '开箱',
  ]

  try {
    const values = categoryNames.map(name => ({
      name,
      description: `${name}相关的视频`,
    }))
    await db.insert(categories).values(values)
    console.log('Categories seeded successfully.')
  } catch (e) {
    console.error('Error seeding categories:', e)
    process.exit(1)
  }
}

main()

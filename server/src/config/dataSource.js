const { DataSource } = require('typeorm');
require('dotenv').config();

// SỬA LẠI Ở ĐÂY: Export trực tiếp instance, không qua object
module.exports = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: false,
  entities: [__dirname + '/../entities/*.entity.js'],
  migrations: [__dirname + '/../database/migrations/*.js'],
});

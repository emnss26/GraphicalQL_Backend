module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: "./data/abitat.sqlite3",
    },
    useNullAsDefault: true,
  },
};
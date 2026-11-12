'use strict';

const { handleAuthRoute } = require('../../lib/supabase-auth');

module.exports = function handler(req, res) {
  return handleAuthRoute('register', req, res);
};

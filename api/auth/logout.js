'use strict';

const { handleAuthRoute } = require('../../lib/supabase-auth');

module.exports = function handler(req, res) {
  return handleAuthRoute('logout', req, res);
};

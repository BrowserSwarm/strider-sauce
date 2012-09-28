//
// Strider Webapp extension for Sauce Labs tests
//

module.exports = function(ctx, cb) {
  /*
   * GET /api/sauce/
   *
   * Get the current Strider config for specified project. This will be a JSON-encoded
   * object with the keys: sauce_username, sauce_access_key and sauce_browsers
   *
   * @param url Github html_url of the project.
   */
  function getIndex(req, res) {
    var url = req.param("url")

    function error(err_msg) {
      console.error("Strider-Sauce: getIndex() - %s", err_msg)
      var r = {
        errors: [err_msg],
        status: "error"
      }
      res.statusCode = 400
      return res.end(JSON.stringify(r, null, '\t'))
    }

    req.user.get_repo_config(url, function(err, repo, access_level, owner_user_obj) {
      if (err) {
        return error("Error fetching Repo Config for url " + url + ": " + err)
      }
      repo = repo.toJSON()
      var r = {
        status: "ok",
        errors: [],
        results: {
          sauce_username: repo.sauce_username,
          sauce_access_key: repo.sauce_access_key,
          sauce_browsers: repo.sauce_browsers,
        }
      }
      return res.end(JSON.stringify(r, null, '\t'))
    })
  }

  /*
   * POST /api/sauce/
   *
   * Set the current Strider config for specified project.
   *
   * @param url Github html_url of the project.
   * @param sauce_username Sauce Labs username.
   * @param sauce_access_key Sauce Labs access key.
   * @param sauce_browsers JSON-encoded list of object tuples.
   *
   */
  function postIndex(req, res) {
    var url = req.param("url")
    var sauce_username = req.param("sauce_username")
    var sauce_access_key = req.param("sauce_access_key")
    var sauce_browsers = req.param("sauce_browsers")

    function error(err_msg) {
      console.error("Strider-Sauce: postIndex() - %s", err_msg)
      var r = {
        errors: [err_msg],
        status: "error"
      }
      res.statusCode = 400
      return res.end(JSON.stringify(r, null, '\t'))
    }

    req.user.get_repo_config(url, function(err, repo, access_level, owner_user_obj) {
      if (err) {
        return error("Error fetching Repo Config for url " + url + ": " + err)
      }
      // must have access_level > 0 to be able to continue;
      if (access_level < 1) {
        console.debug(
          "User %s tried to change sauce config but doesn't have admin privileges on %s (access level: %s)",
          req.user.email, url, access_level);
        return error("You must have access level greater than 0 in order to be able to configure sauce.");
      }
      var q = {$set:{}}
      if (sauce_username) {
        repo.sauce_username = q['$set']['github_config.$.sauce_username'] = sauce_username
      }
      if (sauce_access_key) {
        repo.sauce_access_key = q['$set']['github_config.$.sauce_access_key'] = sauce_access_key
      }
      if (sauce_browsers) {
        var invalid = false
        try {
          sauce_browsers = JSON.parse(sauce_browsers)
          if (!Array.isArray(sauce_browsers)) {
            invalid = true
          }
        } catch(e) {
          invalid = true
        }
        if (invalid) {
          return error("Error decoding `sauce_browsers` parameter - must be JSON-encoded array")
        }
        repo.sauce_browsers = q['$set']['github_config.$.sauce_browsers'] = sauce_browsers
      }
      var r = {
        status: "ok",
        errors: [],
        results: {
          sauce_username: repo.sauce_username,
          sauce_access_key: repo.sauce_access_key,
          sauce_browsers: repo.sauce_browsers,
        }
      }
      if (sauce_username || sauce_access_key || sauce_browsers) {
        ctx.models.User.update({"github_config.url":repo.url}, q, function(err) {
            if (err) {
              var errmsg = "Error saving sauce config " + req.user.email + ": " + err;
              return error(errmsg)
            }
            return res.end(JSON.stringify(r, null, '\t'))
        })
      } else {
        return res.end(JSON.stringify(r, null, '\t'))
      }
    })

  }

  // Extend RepoConfig model with 'Sauce' properties
  function saucePlugin(schema, opts) {
    schema.add({
      sauce_access_key: String,
      sauce_username: String,
      sauce_browsers: [],
    })
  }
  ctx.models.RepoConfig.plugin(saucePlugin)

  // Add webserver routes
  ctx.route.get("/api/sauce",
    ctx.middleware.require_auth,
    ctx.middleware.require_params(["url"]),
    getIndex)
  ctx.route.post("/api/sauce",
    ctx.middleware.require_auth,
    ctx.middleware.require_params(["url"]),
    postIndex)


  console.log("strider-sauce webapp extension loaded")

  cb(null, null)
}

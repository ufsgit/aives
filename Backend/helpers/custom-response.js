/**
 * Custom API response
 * @author Rahul om<rahulom666@gmail.com>
 */

class CustomResponse {
//   response;
//   res;
//   req;
//   language;

  /**
   * @param res Response object from
   */

  constructor(req, res) {
    this.res = res;
    this.req = req;
    this.language =
      this.req.headers["accept-language"] ||
      this.req.query.lan ||
      process.env.defaultLanguge ||
      "en";
  }

   send() {
    if (typeof this.response.message == "object") {
      if (this.response.message["message"]) {
        this.response.message = this.response.message["message"];
      }
    }
    this.res.send(this.response);
    this.res.end();
  };
  /**
   * Send error status to client
   */
  sendError(res, sessionExpired) {
    res.status = "error";
    this.response = res;
    this.res.status(400);
    this.response.status_code = sessionExpired ? 30000 : 20000;
    this.send();
    return false;
  };

  sendSuccess(res) {
    res.status = "success";
    this.response = res;
    this.response.status_code = 10000;
    this.send();
    return true;
  };
  sendPage(res) {
    res.status = "success";
    this.response = res;
    this.response.status_code = 10000;
    return this.send();
  };
}
module.exports = CustomResponse;

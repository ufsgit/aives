const fs = require('fs')
var express = require('express');
var router = express.Router();
const { Juspay, APIError } = require('expresscheckout-nodejs')
const { v4: uuidv4 } = require('uuid');
const {executeTransaction} = require('../helpers/sp-caller');


const Development_BASE_URL = "https://smartgatewayuat.hdfcbank.com"
const PRODUCTION_BASE_URL = "https://smartgateway.hdfcbank.com"


 const config = require('../config/payment/hdfc-prod/config.json')
// const config = require('../config/payment/hdfc-dev/config.json')
const publicKey = fs.readFileSync(config.PUBLIC_KEY_PATH)
const privateKey = fs.readFileSync(config.PRIVATE_KEY_PATH)
const paymentPageClientId = config.PAYMENT_PAGE_CLIENT_ID // used in orderSession request


const juspay = new Juspay({
    merchantId: config.MERCHANT_ID,
    baseUrl: PRODUCTION_BASE_URL,
    jweAuth: {
        keyId: config.KEY_UUID,
        publicKey,
        privateKey
    }
})





router.post('/initiateJuspayPayment', async (req, res) => {
    const { nanoid } = await import('nanoid');

    const orderId = `${nanoid(18)}`
    const CourseId =  req.body.courseId | null
    console.log(req.body)
    const studentId =  req.userId | 'hdfc-testing-customer-one'
    const CourseDetails = await executeTransaction('Get_Course_By_CourseId', [
        CourseId    ]);
        const amount=CourseDetails[0].Price

    console.log('CourseDetails',CourseDetails)
    // makes return url 
    const returnUrl = `${req.protocol}://${req.hostname}/payment/handleJuspayResponse`

    try {
        const sessionResponse = await juspay.orderSession.create({
            order_id: orderId,
            amount: amount,
            payment_page_client_id: paymentPageClientId,                    // [required] shared with you, in config.json
            customer_id: String(studentId),                       // [optional] your customer id here
            action: 'paymentPage',                                          // [optional] default is paymentPage
            return_url: returnUrl,                                          // [optional] default is value given from dashboard
            currency: 'INR'                                                  // [optional] default is INR
        }) 
        console.log(
            





        )
        await executeTransaction('save_payment_request', [
            orderId,
            amount,
            paymentPageClientId,
            studentId,
            'paymentPage',
            returnUrl,
            'INR',
            sessionResponse.sdk_payload.requestId,
            sessionResponse.status,
            CourseId,
        ]);
        return res.json(makeJuspayResponse(sessionResponse))
    } catch (error) {
        if (error instanceof APIError) {
            return res.json(makeError(error.message))
        }
        return res.json(makeError())
    }
})
router.post('/initiatePayment', async (req, res) => {
    const { nanoid } = await import('nanoid');

    const orderId = `${nanoid(18)}`
    const CourseId =  req.body.courseId | null
    console.log(req.body)
    const studentId =  req.userId | 'hdfc-testing-customer-one'
    const CourseDetails = await executeTransaction('Get_Course_By_CourseId', [
        CourseId    ]);
        const amount=CourseDetails[0].Price

    console.log('CourseDetails',CourseDetails)

    try {
        const Responsepayload = {
            order_id: orderId,
            requestId: orderId,
            amount: amount,
            customer_id: String(studentId),                       // [optional] your customer id here
            action: 'ApplepaymentPage',                                          // [optional] default is paymentPage
            return_url: '',                                          // [optional] default is value given from dashboard
            currency: 'INR'                                                  // [optional] default is INR
        }
        
        console.log('Responsepayload: ', Responsepayload);
        await executeTransaction('save_payment_request', [
            orderId,
            amount,
            'Apple',
            studentId,
            'ApplepaymentPage',
            '',
            'INR',
            orderId,
           'pending',
            CourseId,
        ]);
        return res.json(Responsepayload)
    } catch (error) {
     
        res.status(500).json({ success: false, message: 'Failed to initiate payment', error: error });
    }
})

router.post('/handleJuspayResponse', async (req, res) => {
    const orderId = req.body.order_id || req.body.orderId

    if (orderId == undefined) {
        return res.json(makeError('order_id not present or cannot be empty'))
    }

    try {
        const statusResponse = await juspay.order.status(orderId)
        console.log('statusResponse status ********',statusResponse)

        const orderStatus = statusResponse.status
        console.log('again status ********',orderStatus)
        let message = ''



        switch (orderStatus) {
            case "CHARGED":
                message = "order payment done successfully"
                break
            case "PENDING":
            case "PENDING_VBV":
                message = "order payment pending"
                break
            case "AUTHORIZATION_FAILED":
                message = "order payment authorization failed"
                break
            case "AUTHENTICATION_FAILED":
                message = "order payment authentication failed"
                break
            default:
                message = "order status " + orderStatus
                break 
        }

        // removes http field from response, typically you won't send entire structure as response
        await executeTransaction('save_payment_request', [
            orderId,
            statusResponse.amount || 0,
            paymentPageClientId,
            statusResponse.customer_id || '',
            'paymentPage',
            '',
            statusResponse.currency || 'INR',
            orderStatus  // This will update the status of existing record
        ]);
        return res.send(makeJuspayResponse(statusResponse))
    } catch(error) {
        if (error instanceof APIError) {
            // handle errors comming from juspay's api,
            return res.json(makeError(error.message))
        }
        return res.json(makeError())
    }
})




// Utitlity functions
function makeError(message) {
    return {
        message: message || 'Something went wrong'
    }
}

function makeJuspayResponse(successRspFromJuspay) {
    if (successRspFromJuspay == undefined) return successRspFromJuspay
    if (successRspFromJuspay.http != undefined) delete successRspFromJuspay.http
    return successRspFromJuspay
}
module.exports = router;

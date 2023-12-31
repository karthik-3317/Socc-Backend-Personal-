import asyncHandler from 'express-async-handler'
import Sessions from '../models/SessionsModel.js'
import nodemailer from 'nodemailer'
import Feedback from '../models/FeedBack.js';
import Mailgen from "mailgen"
import AdminRegister from '../models/Register.js';
import { generateToken } from '../Config/Jwt_GenerateToken.js';
import superUser from '../models/SuperUser.js';
import crypto from 'crypto'

export const registration = asyncHandler(async (req, res) => {
    try {
        console.log(req.body);
        const newRegistration = await Sessions.create(req.body);
        res.status(201).json(newRegistration);
    } catch (error) {
        res.status(500).json({ message: 'Session Registration Failed', error: error.message });
    }
});


export const getAllSessions = asyncHandler(async (req, res) => {
    try {
        const allsessions = await Sessions.find();
        res.json(allsessions);
    } catch (error) {
        res.status(500).json({ message: "Fetching Sessions Failed", error: error.message });
    }
});


export const getSessionById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const singleSession = await Sessions.findById(id);
        if (singleSession) {
            res.json(singleSession);
        } else {
            res.json({ message: 'Invalid Id. Session Not Fetched' });
        }
    } catch (error) {
        res.status(500).json({ message: "Session Fetching Failed", error: error?.message });
    }
});


export const feedbackRating = asyncHandler(async (req, res) => {
    try {
        const feedback = await Feedback.create(req.body);
        if (feedback) {
            res.json(feedback);
        } else {
            res.json({ error: "Error In Submission FeedBack" });
        }
    } catch (error) {
        res.status(500).json({ message: "Rating Submission Failed", error: error?.message });
    }
});


export const uploads = async(filesData)=>{
    const files = filesData
    console.log(files);
  
    if(!files)
    {
      const error = new Error('Please Choose Files')
      error.httpStatusCode = 400
      return next(error)
    }
  
    res.json(files)
  }

export const adminRegister = asyncHandler(async (req,res)=>{
    const {username,email,phone} = req.body
    try {
        const encodedemail = encodeURIComponent(email);
        const encodedusername = encodeURIComponent(username);
        const encodedephone = encodeURIComponent(phone);
        const findEmail = await AdminRegister.findOne({encodedemail})
        if(findEmail) res.json({status:409,message:"Email Already Taken"})
        const findPhone = await AdminRegister.findOne({encodedephone})
        if(findPhone) res.json({status:409,message:"Phone Number Already Taken"})
        const findUsername = await AdminRegister.findOne({encodedusername})
        if(findUsername) res.json({status:409,message:'Username Already Taken'})

        const createAdminUser = await AdminRegister.create(req.body)
        if(createAdminUser) res.json({status:201,message:"Admin User Created "})
        else res.json({status:500,message:'User Creation Fails'})
    } catch (error) {
        res.json({status:500,message:'User Creation Fails'})
    }
})

export const adminLogin = asyncHandler(async (req, res) => {
    console.log(req.body);
    let { username, password } = req.body; // Use let to allow reassignment
    try {
        // Decode the username and password if they were encoded before sending
        // username = decodeURIComponent(username);
        // password = decodeURIComponent(password);

        const adminLogin = await AdminRegister.findOne({ username });
        console.log(adminLogin);

        if (!adminLogin) {
            res.json({ status: 305, message: "Admin User Not Found" });
        }

        if (adminLogin && await adminLogin.isPasswordMatched(password)) {
            const refreshToken = await generateToken(adminLogin?._id);
            const updateAdminUser = await AdminRegister.findByIdAndUpdate(adminLogin?._id, {
                refreshedToken: refreshToken
            }, { new: true });

            res.json({
                _id: adminLogin?._id,
                firstname: adminLogin?.firstname,
                lastname: adminLogin?.lastname,
                email: adminLogin?.email,
                username: adminLogin?.username,
                phone: adminLogin?.phone,
                refreshedToken: updateAdminUser?.refreshedToken,
                status: 201
            });
        } else {
            res.json({ status: 404, message: "Password Not Matched" });
        }
    } catch (error) {
        res.json({ status: 500, error: error, message: 'Invalid Credentials' });
    }
});


export const superUserTokenAuth = asyncHandler(async(req,res)=>{
    const {token} = req.body
    try {
        const count = await superUser.countDocuments()
        let createSuperUserToken
        if (count >= 1) {
            const deleteResult = await superUser.deleteMany({});
            createSuperUserToken = await superUser.create({token:token}) 
          } else {
             createSuperUserToken = await superUser.create({token:token}) 
          }
        sendTokenViaEmail(token)
        if(createSuperUserToken)
        res.json(createSuperUserToken)
    } catch (error) {
        throw new Error(error)
    }
})

export const deletesuperUserToken = asyncHandler(async(req,res)=>{
    const {token} = req.body
    try {
        const deleteToken = await superUser.deleteOne({token})
        if(deleteToken)
        {
            res.json('Token Deleteed')
        }
        else{
            res.json('Token Not Found')
        }
    } catch (error) {
        throw new Error(error)
    }
})

export const resetpassword = asyncHandler(async(req,res)=>{
    const {password} = req.body
    console.log(req.body);
    const {uniqToken} = req.params
    console.log(password);
    console.log(uniqToken);
    try {
    const hashedToken = crypto.createHash('sha256').update(uniqToken).digest("hex")
    const user = await AdminRegister.findOne({
        passwordResetToken:hashedToken.toString(),
        passwordResetExpires:{$gt:Date.now()}
    })
    if(!user) res.json({status:500,message:'Token Expired, Please try again later'})  
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save()
    res.json({user:user,status:201})
    } catch (error) {
        throw new Error(error)
    }
})

export const forgotpassword = asyncHandler(async(req,res)=>{
    const {email,token} = req.body;
    try {
        const mailFound = await AdminRegister.findOne({email})
        if(!mailFound) res.json({status:404,message:"User Not Found"})
        if(mailFound)
        {
            const ResetToken = await mailFound.createPasswordResetToken(token)
            await mailFound.save()
            sendPasswordResetToken({
                email:email,
                uniqcode:token,
            })
            res.json({status:201,message:"User Found",uniqToken:ResetToken})
        }   
    } catch (error) {
        throw new Error(error)
    }
})

export const forgotpasswordverify = asyncHandler(async(req,res)=>{
    const {uniqToken} = req.params;
    const {token} = req.body
    const hashedToken = crypto.createHash('sha256').update(uniqToken).digest("hex")
    try {
        const mailFound = await AdminRegister.findOne({ passwordResetToken:hashedToken.toString()})
        if(!mailFound) res.json({status:404,message:"User Not Found"})
        console.log(mailFound?.oneTimeOTP);
        console.log(token);
        if(mailFound && typeof token === 'number' && parseInt(mailFound?.oneTimeOTP) === token)  
        {   
            const removeOTP = await AdminRegister.findOneAndUpdate({passwordResetToken:hashedToken.toString()},{
                oneTimeOTP:null
            },{new:true})    
            res.json({status:201,message:"OTP Verification Successfull"})
        }
        else{
            res.json({status:500,message:"OTP Verification Unsuccessfull"})
        }
    } catch (error) {
        throw new Error(error)
    }
})

export const getsuperuserToken = asyncHandler(async(req,res)=>{
    const {token} = req.body;
    try {
        const findToken = await superUser.findOne({token:token})
        if(findToken)
        {
            res.json({'status':201})
        }
        else if(!findToken)
        res.json({'status':404})
        res.json({'status':344})
    } catch (error) {
        throw new Error(error)
    }
})

const sendTokenViaEmail = (token) => {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.MAIL_PASSWORD,       
      },
    });
      const mailOptions = {
      from: 'your_gmail_account@gmail.com',   
      to: 'saipavan39dh@gmail.com',
      subject: 'Socc SuperUser Token Service',
      html: `
        <p>Socc Email Super User Token</p>
        <p>Token For Access SuperUser: ${token}</p>
        <p>Visit the Socc Official website: <a href="https://mailgen.js">Socc Official</a></p>
      `,
    };
      transporter.sendMail(mailOptions)
      .then(info => {
        console.log('Email sent:', info.response);
      })
      .catch(error => {
        console.error('Error sending email:', error.message);
      });
};

const sendPasswordResetToken = (data) => {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.MAIL_PASSWORD,       
      },
    });
      const mailOptions = {
      from: 'SoccOfficialMail@gmail.com',   
      to: data?.email,
      subject: 'Socc Forgot Password Token Service',
      html: `
        <p>Socc Forgot Password Token</p>
        <p>Password Reset OTP: ${data?.uniqcode} </p>
        <p>Visit the Socc Official website: <a href="https://mailgen.js">Socc Official</a></p>
      `,
    };
      transporter.sendMail(mailOptions)
      .then(info => {
        console.log('Email sent:', info.response);
      })
      .catch(error => {
        console.error('Error sending email:', error.message);
      });
};



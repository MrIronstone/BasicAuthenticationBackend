const express = require('express');
const router = express.Router();

// mongodb user model
const User = require('./../models/user');

// mongodb user verification model
const UserVerification = require('./../models/userVerification');

// email handler
const nodemailer = require('nodemailer');

// password handler
const bcrypt = require('bcrypt');

// uuid handler
const {v4: uuidv4} = require('uuid');

// env variables
require("dotenv").config()

// nodemailer stuff
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    }
})

// testing nodemailer
transporter.verify((error, success) => {
    if(error) {
        console.log(error);
    } else {
        console.log("Reader for messages");
        console.log(success);
    }
});

// verif

// Signup
router.post('/signup', (req, res) => {
    let { name, email, password, dateOfBirth } = req.body;

    name = name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if(name == "" || email == "" || password == "" || dateOfBirth == "" ) {
        res.json({
            status: "FAILED",
            message: "Empty input fields!"
        })
    } else if (!/^[a-zA-Z ]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered!"
        })
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email entered!"
        })
    } else if (!new Date(dateOfBirth).getTime()) {
        res.json({
            status: "FAILED",
            message: "Invalid date of birth entered!"
        })
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "Password is too short!"
        })
    } else {
        // Checking if user already exist
        User.find({email}).then(result => {
            if(result.length) {
                // user already exist
                res.json({
                    status: "FAILED",
                    message: "User already exist with the mail"
                })
            } else {
                // new user

                // password handling
                
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth,
                        verified: false,
                    });

                    newUser.save().then(result => {
                        
                        // handle account verification
                        sendVerificationCode(result, res);
                            
                    }).catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving user account"
                        })
                    })
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "An error occured while hashing the password: ${err}"
                    })
                })
            }

        }).catch(err => {
            console.log(err);
            res.json({
                status: "FAILED",
                message: "An error occured while checking for existing account"
            })
        })
    }

})

// send verification email
const sendVerificationCode = ({_id, email}, res) => {
    // url to be used in the email
    const currentUrl = "http://localhost:5000/";

    const uniqueString = uuidv4() + _id

    // mail options
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify Your Email",
        html: `<p>Verify your email adress to complete the signup and login into your account.</p><p>This link <b>expire in 6 hours</b></p><p>Press <a href=${
            currentUrl + "user/verify/" + _id + '/' + uniqueString
        }> here </a> to proceed </p>`,
    };

    // hash the uniqueString
    const saltRounds = 10;
    bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
        // set values in userVerification collection
        const newVerification = new UserVerification({
            userId: _id,
            uniqueString: hashedUniqueString,
            createdAt: Date.now(),
            expiresAt: Date.now() + 21600000,
        });

        newVerification.save()
        .then(() => {
            transporter.sendMail(mailOptions)
            .then(() => {
                // email successfully sent and verification record's been saved
                res.json({
                    status: "PENDING",
                    message: "Verification code sent"
                })
            })
            .catch((error) => {
                console.log(error);
                res.json({
                    status: "FAILED",
                    message: "Failed to send verification mail"
                }); 
            })
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "Couldn't save verification email data!"
            })
        })
    })
    .catch(() => {
        res.json({
            status: "FAILED",
            message: "An error occured while hashing the email data!"
        })
    })
};

// verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
    let {userId, uniqueString} = req.params

    UserVerification.find({userId})
    .then((result) => {
        if (result.length > 0) {
            // user verified and record exist so everything is good
    
            const { expiresAt } = result[0];

            const hashedUniqueString = result[0].uniqueString

            // checking for expired unique string
            if (expiresAt < Date.now()) {
                // record has expired so we delete it
                UserVerification.deleteOne({_id: userId })
                .then((result) => {
                    // successfully deleted user verification and we can delete user as well
                    User.deleteOne({ userId })
                    .then((result) => {
                        console.log(error);
                        res.json({
                            status: "FAILED",
                            message: "Link has expired. Please sign up again"
                        }) 
                    })
                    .catch((error) => {
                        console.log(error);
                        res.json({
                            status: "FAILED",
                            message: "An error occured while trying to delete the expired user record from db"
                        })   
                    })
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "An error occured while trying to delete the expired user verification record from db"
                    })
                })
            } else {
                // valid record exist and not expired

                // first compare the hashed unique string

                bcrypt.compare(uniqueString, hashedUniqueString)
                .then(result => {
                    if(result) {
                        // string match

                        User.updateOne({_id: userId}, {verified: true})
                        .then(() => {
                            UserVerification.deleteOne({userId})
                            .then(() => {
                                console.log("Verified successfully")
                                res.json({
                                    status: "SUCCESS",
                                    message: "Verification is successful"
                                })
                            })
                            .catch(error => {
                                console.log(error);
                                res.json({
                                    status: "FAILED",
                                    message: "An error occured while trying to delete user verification"
                                })
                            })
                        })
                        .catch(error => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "An error occured while updating user record"
                            })
                        })

                    } else {
                        // existing record but incorrect verification somehow
                        res.json({
                            status: "FAILED",
                            message: "Invalid verification details passed. Check your inbox"
                        })
                    }
                })
                .catch(error => {
                    console.log(error)
                    res.json({
                        status: "FAILED",
                        message: "Failed while comparing unique string"
                    })
                })
            }

            res.json({
            status: "Sucess",
            message: ""
        })
        } else {
            // user verification record doesn't exist
            res.json({
            status: "FAILED",
            message: "User verification record doesn't exist or has been verified already. Please log in or sign up."
            })
        }
    })
    .catch((error) => {
        console.log(error);
        res.json({
            status: "FAILED",
            message: "An error occured while checking for existing user verification record"
        })
    })
})

// Signin
router.post('/signin', (req, res) => {

    let {email, password } = req.body;

    email = email.trim();
    password = password.trim();

    if (email == "" || password == "")  {
        res.json({
            status: "FAILEED",
            message: "Empty credentials supplied"
        })
    } else {
        // check if user exist
        User.find({email}).then(data => {
            if(data.length) {
                // user exist 

                // check if user is verified
                if (!data[0].verified) {
                    res.json({
                        status: "FAILED",
                        message: "Email hasn't been verified. Check your email",
                    })
                } else {
                    const hashedPassword = data[0].password;
                    bcrypt.compare(password, hashedPassword).then(result => {
                        if(result) {
                            // password match
                            res.json({
                                status: "SUCCESS",
                                message: "Signin successfull",
                                data: data
                            })
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Invalid password entered"
                            })
                        }
                    }).catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while comparing passwords"
                        })

                    })
                }
            } else {
                res.json({
                    status: "FAILED",
                    message: "Invalid credentials entered!"
                })
            }
        }).catch(err => {
            res.json({
                status: "FAILED",
                message: "An error occured while checking for existing account"
            })
        })
    }
    
})

module.exports = router;
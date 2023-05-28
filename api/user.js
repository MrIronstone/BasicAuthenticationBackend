const express = require('express');
const router = express.Router();

// mongodb user model
const User = require('./../models/user');

// password handler
const bcrypt = require('bcrypt');

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
    } else if (!/^[a-zA-Z]*$/.test(name)) {
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
                        dateOfBirth
                    });

                    newUser.save().then(result => {
                        res.json({
                            status: 'SUCCESS',
                            message: "Signup successfully",
                            data: result,
                        })
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
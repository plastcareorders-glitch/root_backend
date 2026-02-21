import express from 'express'
import { getProfile, logoutUser, updateUser } from '../controllers/authController.js'
import upload from '../middlewares/uploadMiddleware.js'
import { DoCommitFamilyCircleMemory, fetchFamilyCircle, fetchFamilyCircleMemory, InviteUser, updateFamilyCircleMemory, updateFamilyRole } from '../controllers/invite.controller.js'

export const UserRouter = express.Router()

UserRouter.get('/test',(req,res)=>{
    res.send("Hello")
})
UserRouter.get('/fetch-profile',getProfile)
UserRouter.put('/update-profile',upload.single("profileImage"),updateUser) // add photo
UserRouter.post('/sendinvite',InviteUser)
UserRouter.get('/logout',logoutUser)
UserRouter.get('/fetchfamily',fetchFamilyCircle)
UserRouter.put('/updatefamily',updateFamilyRole)
UserRouter.get('/fetchfamilymemory',fetchFamilyCircleMemory)
UserRouter.post('/memorycomment/:memoryId',DoCommitFamilyCircleMemory)
UserRouter.put('/updatememory/:memoryId',updateFamilyCircleMemory)
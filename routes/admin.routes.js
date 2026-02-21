import express from 'express'
import { checkAdmin } from '../middlewares/checkAdmin.js'
import { fetchAllUser, fetchAllUserAndMemory, fetchUserStatics, getAllBlogs, getSingleBlog } from '../controllers/admin/admin.controller.js'
import { checkAuth } from '../middlewares/checkAuth.js'

export const adminRouter = express.Router()

adminRouter.get('/getall-blogs',checkAuth,  checkAdmin,getAllBlogs)
adminRouter.get('/blog/:id',checkAuth,checkAdmin,getSingleBlog)
adminRouter.get('/fetch-alluser-memory',checkAuth,checkAdmin,fetchAllUserAndMemory)
adminRouter.get('/fetch-alluser',checkAuth,checkAdmin,fetchAllUser)
adminRouter.get('/fetch-statics',checkAuth,checkAdmin,fetchUserStatics)
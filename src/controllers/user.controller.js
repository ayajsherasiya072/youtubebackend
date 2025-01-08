import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadonCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'

const registerUser=asyncHandler(async (req,res)=>{
   
    const {email,fullname,username,password}=req.body

    if([fullname,email,username,password].some((field)=>(field?.trim()==="")))
    {
        throw new ApiError(400,"All field are required")
    }

    const existUser= await User.findOne({
        $or:[{email},{username}]
    })
    if(existUser)
    {
        throw new ApiError(409,"User already exist")
    }

    const avatarLocatPath=req.files?.avatar[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if(!avatarLocatPath){
        throw new ApiError(400,"Avatar is required")
    }

    const avatar=await uploadonCloudinary(avatarLocatPath)
    const coverImage=await uploadonCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required")
    }

    const user=await User.create({
        email,
        fullname,
        username:username.toLowerCase(),
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        password,
    })

    const creadetUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!creadetUser)
    {
        throw new ApiError(500,"something went wrong while creating user")
    }

    return res.status(201).json(
        new ApiResponse(200,creadetUser,"user register successfully")
    )

})

export {registerUser}